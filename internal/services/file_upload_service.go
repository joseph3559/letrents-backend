package services

import (
	"context"
	"crypto/md5"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type FileUploadService struct {
	provider     CloudProvider
	maxFileSize  int64
	allowedTypes map[string]bool
	uploadPath   string
}

type CloudProvider interface {
	Upload(ctx context.Context, file io.Reader, filename, contentType string, metadata map[string]string) (*UploadResult, error)
	Delete(ctx context.Context, fileID string) error
	GetSignedURL(ctx context.Context, fileID string, expiration time.Duration) (string, error)
	GenerateThumbnail(ctx context.Context, fileID string, width, height int) (*UploadResult, error)
}

type UploadResult struct {
	FileID      string            `json:"file_id"`
	FileName    string            `json:"file_name"`
	URL         string            `json:"url"`
	CDNUrl      string            `json:"cdn_url,omitempty"`
	Size        int64             `json:"size"`
	ContentType string            `json:"content_type"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
}

type FileMetadata struct {
	MessageID    uuid.UUID `json:"message_id"`
	UploadedBy   uuid.UUID `json:"uploaded_by"`
	OriginalName string    `json:"original_name"`
	Size         int64     `json:"size"`
	ContentType  string    `json:"content_type"`
	IsImage      bool      `json:"is_image"`
	Width        int       `json:"width,omitempty"`
	Height       int       `json:"height,omitempty"`
	Hash         string    `json:"hash"`
}

type UploadOptions struct {
	MessageID         *uuid.UUID        `json:"message_id,omitempty"`
	GenerateThumbnail bool              `json:"generate_thumbnail"`
	ThumbnailSize     int               `json:"thumbnail_size"`
	Metadata          map[string]string `json:"metadata"`
	UploadPath        string            `json:"upload_path,omitempty"`
}

type FileValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e FileValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Default configurations
const (
	DefaultMaxFileSize = 50 * 1024 * 1024 // 50MB
	DefaultUploadPath  = "communications/attachments"
	ThumbnailSize      = 300
)

var DefaultAllowedTypes = map[string]bool{
	// Images
	"image/jpeg":    true,
	"image/jpg":     true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,

	// Documents
	"application/pdf":    true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         true,
	"application/vnd.ms-powerpoint":                                             true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
	"text/plain":      true,
	"text/csv":        true,
	"application/rtf": true,

	// Archives
	"application/zip":              true,
	"application/x-rar-compressed": true,
	"application/x-7z-compressed":  true,

	// Audio
	"audio/mpeg": true,
	"audio/wav":  true,
	"audio/ogg":  true,
	"audio/mp4":  true,

	// Video
	"video/mp4":       true,
	"video/quicktime": true,
	"video/x-msvideo": true,
	"video/webm":      true,
}

func NewFileUploadService(provider CloudProvider) *FileUploadService {
	return &FileUploadService{
		provider:     provider,
		maxFileSize:  DefaultMaxFileSize,
		allowedTypes: DefaultAllowedTypes,
		uploadPath:   DefaultUploadPath,
	}
}

func (s *FileUploadService) SetMaxFileSize(size int64) {
	s.maxFileSize = size
}

func (s *FileUploadService) SetAllowedTypes(types map[string]bool) {
	s.allowedTypes = types
}

func (s *FileUploadService) SetUploadPath(path string) {
	s.uploadPath = path
}

func (s *FileUploadService) UploadFile(ctx context.Context, file multipart.File, header *multipart.FileHeader, userID uuid.UUID, options UploadOptions) (*UploadResult, error) {
	// Validate file
	if err := s.validateFile(header); err != nil {
		return nil, err
	}

	// Generate unique filename
	fileID := uuid.New().String()
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%s%s", fileID, ext)

	// Create upload path
	uploadPath := s.uploadPath
	if options.UploadPath != "" {
		uploadPath = options.UploadPath
	}

	// Add date-based directory structure
	now := time.Now()
	fullPath := fmt.Sprintf("%s/%d/%02d/%s", uploadPath, now.Year(), now.Month(), filename)

	// Calculate file hash
	file.Seek(0, 0) // Reset file pointer
	hash, err := s.calculateFileHash(file)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate file hash: %w", err)
	}
	file.Seek(0, 0) // Reset file pointer again

	// Prepare metadata
	metadata := map[string]string{
		"uploaded_by":   userID.String(),
		"original_name": header.Filename,
		"file_hash":     hash,
		"upload_date":   now.Format(time.RFC3339),
	}

	if options.MessageID != nil {
		metadata["message_id"] = options.MessageID.String()
	}

	// Add custom metadata
	for k, v := range options.Metadata {
		metadata[k] = v
	}

	// Check if it's an image
	isImage := s.isImageFile(header.Header.Get("content-type"))
	if isImage {
		metadata["is_image"] = "true"

		// Get image dimensions if possible
		if width, height, err := s.getImageDimensions(file); err == nil {
			metadata["width"] = fmt.Sprintf("%d", width)
			metadata["height"] = fmt.Sprintf("%d", height)
		}
		file.Seek(0, 0) // Reset file pointer
	}

	// Upload file
	result, err := s.provider.Upload(ctx, file, fullPath, header.Header.Get("content-type"), metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	// Generate thumbnail for images if requested
	if isImage && options.GenerateThumbnail {
		thumbnailSize := options.ThumbnailSize
		if thumbnailSize == 0 {
			thumbnailSize = ThumbnailSize
		}

		if thumbnailResult, err := s.provider.GenerateThumbnail(ctx, result.FileID, thumbnailSize, thumbnailSize); err == nil {
			result.Metadata["thumbnail_url"] = thumbnailResult.URL
		}
	}

	return result, nil
}

func (s *FileUploadService) UploadMultipleFiles(ctx context.Context, files []*multipart.FileHeader, userID uuid.UUID, options UploadOptions) ([]*UploadResult, []error) {
	results := make([]*UploadResult, len(files))
	errors := make([]error, len(files))

	for i, header := range files {
		file, err := header.Open()
		if err != nil {
			errors[i] = fmt.Errorf("failed to open file %s: %w", header.Filename, err)
			continue
		}

		result, err := s.UploadFile(ctx, file, header, userID, options)
		file.Close()

		if err != nil {
			errors[i] = err
		} else {
			results[i] = result
		}
	}

	return results, errors
}

func (s *FileUploadService) DeleteFile(ctx context.Context, fileID string) error {
	return s.provider.Delete(ctx, fileID)
}

func (s *FileUploadService) GetSignedURL(ctx context.Context, fileID string, expiration time.Duration) (string, error) {
	return s.provider.GetSignedURL(ctx, fileID, expiration)
}

func (s *FileUploadService) GetFileInfo(ctx context.Context, fileID string) (*FileMetadata, error) {
	// This would typically query your database for file metadata
	// Implementation depends on your database setup
	return nil, fmt.Errorf("not implemented")
}

func (s *FileUploadService) validateFile(header *multipart.FileHeader) error {
	// Check file size
	if header.Size > s.maxFileSize {
		return FileValidationError{
			Field:   "size",
			Message: fmt.Sprintf("file size %d exceeds maximum allowed size %d", header.Size, s.maxFileSize),
		}
	}

	// Check file type
	contentType := header.Header.Get("content-type")
	if contentType == "" {
		// Try to detect content type from filename
		contentType = s.detectContentType(header.Filename)
	}

	if !s.allowedTypes[contentType] {
		return FileValidationError{
			Field:   "type",
			Message: fmt.Sprintf("file type %s is not allowed", contentType),
		}
	}

	// Check filename
	if strings.TrimSpace(header.Filename) == "" {
		return FileValidationError{
			Field:   "filename",
			Message: "filename cannot be empty",
		}
	}

	// Check for potentially dangerous filenames
	if s.isDangerousFilename(header.Filename) {
		return FileValidationError{
			Field:   "filename",
			Message: "filename contains potentially dangerous characters",
		}
	}

	return nil
}

func (s *FileUploadService) calculateFileHash(file io.Reader) (string, error) {
	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

func (s *FileUploadService) isImageFile(contentType string) bool {
	return strings.HasPrefix(contentType, "image/")
}

func (s *FileUploadService) getImageDimensions(file io.Reader) (int, int, error) {
	// This is a placeholder - in a real implementation, you'd use an image library
	// like github.com/disintegration/imaging or similar to get actual dimensions
	return 0, 0, fmt.Errorf("not implemented")
}

func (s *FileUploadService) detectContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))

	contentTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".ppt":  "application/vnd.ms-powerpoint",
		".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		".txt":  "text/plain",
		".csv":  "text/csv",
		".zip":  "application/zip",
		".rar":  "application/x-rar-compressed",
		".7z":   "application/x-7z-compressed",
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".ogg":  "audio/ogg",
		".mp4":  "video/mp4",
		".mov":  "video/quicktime",
		".avi":  "video/x-msvideo",
		".webm": "video/webm",
	}

	if contentType, exists := contentTypes[ext]; exists {
		return contentType
	}

	return "application/octet-stream"
}

func (s *FileUploadService) isDangerousFilename(filename string) bool {
	dangerous := []string{
		"..",
		"./",
		"../",
		"~",
		"$",
		"`",
		"|",
		";",
		"&",
		"<",
		">",
	}

	lower := strings.ToLower(filename)
	for _, danger := range dangerous {
		if strings.Contains(lower, danger) {
			return true
		}
	}

	// Check for executable extensions
	execExtensions := []string{
		".exe", ".bat", ".cmd", ".com", ".pif", ".scr", ".vbs", ".js", ".jar",
		".app", ".deb", ".pkg", ".dmg", ".run", ".sh", ".bash",
	}

	ext := strings.ToLower(filepath.Ext(filename))
	for _, execExt := range execExtensions {
		if ext == execExt {
			return true
		}
	}

	return false
}

// AWS S3 Provider Implementation
type S3Provider struct {
	bucket    string
	region    string
	accessKey string
	secretKey string
}

func NewS3Provider(bucket, region, accessKey, secretKey string) *S3Provider {
	return &S3Provider{
		bucket:    bucket,
		region:    region,
		accessKey: accessKey,
		secretKey: secretKey,
	}
}

func (p *S3Provider) Upload(ctx context.Context, file io.Reader, filename, contentType string, metadata map[string]string) (*UploadResult, error) {
	// This would implement the actual S3 upload logic
	// Using AWS SDK for Go v2
	return &UploadResult{
		FileID:      uuid.New().String(),
		FileName:    filename,
		URL:         fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", p.bucket, p.region, filename),
		Size:        0, // Would be filled from actual upload
		ContentType: contentType,
		Metadata:    metadata,
		CreatedAt:   time.Now(),
	}, nil
}

func (p *S3Provider) Delete(ctx context.Context, fileID string) error {
	// Implement S3 delete logic
	return nil
}

func (p *S3Provider) GetSignedURL(ctx context.Context, fileID string, expiration time.Duration) (string, error) {
	// Implement S3 presigned URL generation
	return "", nil
}

func (p *S3Provider) GenerateThumbnail(ctx context.Context, fileID string, width, height int) (*UploadResult, error) {
	// Implement thumbnail generation (could use AWS Lambda or local processing)
	return nil, nil
}

// Local File System Provider (for development/testing)
type LocalFileProvider struct {
	basePath string
	baseURL  string
}

func NewLocalFileProvider(basePath, baseURL string) *LocalFileProvider {
	return &LocalFileProvider{
		basePath: basePath,
		baseURL:  baseURL,
	}
}

func (p *LocalFileProvider) Upload(ctx context.Context, file io.Reader, filename, contentType string, metadata map[string]string) (*UploadResult, error) {
	// This would implement local file system storage
	// Create directories, save file, etc.
	return &UploadResult{
		FileID:      uuid.New().String(),
		FileName:    filename,
		URL:         fmt.Sprintf("%s/%s", p.baseURL, filename),
		Size:        0, // Would be filled from actual file size
		ContentType: contentType,
		Metadata:    metadata,
		CreatedAt:   time.Now(),
	}, nil
}

func (p *LocalFileProvider) Delete(ctx context.Context, fileID string) error {
	// Implement local file deletion
	return nil
}

func (p *LocalFileProvider) GetSignedURL(ctx context.Context, fileID string, expiration time.Duration) (string, error) {
	// For local files, might return the direct URL or generate a temporary token
	return "", nil
}

func (p *LocalFileProvider) GenerateThumbnail(ctx context.Context, fileID string, width, height int) (*UploadResult, error) {
	// Implement local thumbnail generation
	return nil, nil
}
