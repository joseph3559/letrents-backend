package services

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/imagekit-developer/imagekit-go"
	"github.com/imagekit-developer/imagekit-go/api/uploader"
)

type ImageKitService struct {
	client *imagekit.ImageKit
}

type UploadResponse struct {
	FileID   string `json:"fileId"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	FilePath string `json:"filePath"`
	Size     int64  `json:"size"`
	FileType string `json:"fileType"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

type ImageKitUploadOptions struct {
	Folder            string   `json:"folder"`
	UseUniqueFilename bool     `json:"useUniqueFilename"`
	Tags              []string `json:"tags"`
}

func NewImageKitService() (*ImageKitService, error) {
	// Get credentials from environment
	privateKey := os.Getenv("IMAGEKIT_PRIVATE_KEY")
	publicKey := os.Getenv("IMAGEKIT_PUBLIC_KEY")
	urlEndpoint := os.Getenv("IMAGEKIT_ENDPOINT_URL")

	if privateKey == "" || publicKey == "" || urlEndpoint == "" {
		return nil, fmt.Errorf("ImageKit credentials not found in environment variables")
	}

	ik := imagekit.NewFromParams(imagekit.NewParams{
		PrivateKey:  privateKey,
		PublicKey:   publicKey,
		UrlEndpoint: urlEndpoint,
	})

	return &ImageKitService{
		client: ik,
	}, nil
}

func (s *ImageKitService) UploadFile(ctx context.Context, file multipart.File, header *multipart.FileHeader, options ImageKitUploadOptions) (*UploadResponse, error) {
	// Check if we're in development mode and use mock response
	if os.Getenv("ENV") == "development" {
		return s.mockUpload(header, options)
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Generate unique filename if required
	fileName := header.Filename
	if options.UseUniqueFilename {
		ext := filepath.Ext(fileName)
		name := strings.TrimSuffix(fileName, ext)
		fileName = fmt.Sprintf("%s_%d%s", name, time.Now().Unix(), ext)
	}

	// Prepare upload parameters
	useUniqueFileName := options.UseUniqueFilename
	isPrivateFile := false

	uploadParams := uploader.UploadParam{
		FileName:          fileName,
		UseUniqueFileName: &useUniqueFileName,
		Tags:              strings.Join(options.Tags, ","),
		Folder:            options.Folder,
		IsPrivateFile:     &isPrivateFile,
	}

	// Upload to ImageKit
	result, err := s.client.Uploader.Upload(ctx, fileBytes, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("failed to upload to ImageKit: %w", err)
	}

	// Return structured response
	return &UploadResponse{
		FileID:   result.Data.FileId,
		Name:     result.Data.Name,
		URL:      result.Data.Url,
		FilePath: result.Data.FilePath,
		Size:     int64(result.Data.Size),
		FileType: header.Header.Get("Content-Type"),
		Width:    result.Data.Width,
		Height:   result.Data.Height,
	}, nil
}

// mockUpload creates a mock response for development
func (s *ImageKitService) mockUpload(header *multipart.FileHeader, options ImageKitUploadOptions) (*UploadResponse, error) {
	// Generate a mock file ID
	mockFileID := fmt.Sprintf("mock_%d", time.Now().Unix())

	// Generate a mock URL
	mockURL := fmt.Sprintf("https://ik.imagekit.io/demo/%s/%s", options.Folder, header.Filename)

	return &UploadResponse{
		FileID:   mockFileID,
		Name:     header.Filename,
		URL:      mockURL,
		FilePath: fmt.Sprintf("/%s/%s", options.Folder, header.Filename),
		Size:     header.Size,
		FileType: header.Header.Get("Content-Type"),
		Width:    800, // Mock dimensions
		Height:   600,
	}, nil
}

func (s *ImageKitService) UploadMultipleFiles(ctx context.Context, files []multipart.File, headers []*multipart.FileHeader, options ImageKitUploadOptions) ([]*UploadResponse, error) {
	if len(files) != len(headers) {
		return nil, fmt.Errorf("mismatch between files and headers count")
	}

	var responses []*UploadResponse
	var errors []string

	for i, file := range files {
		response, err := s.UploadFile(ctx, file, headers[i], options)
		if err != nil {
			errors = append(errors, fmt.Sprintf("file %d (%s): %v", i+1, headers[i].Filename, err))
			continue
		}
		responses = append(responses, response)
	}

	if len(errors) > 0 {
		return responses, fmt.Errorf("some uploads failed: %s", strings.Join(errors, "; "))
	}

	return responses, nil
}

func (s *ImageKitService) DeleteFile(ctx context.Context, fileID string) error {
	_, err := s.client.Media.DeleteFile(ctx, fileID)
	if err != nil {
		return fmt.Errorf("failed to delete file from ImageKit: %w", err)
	}
	return nil
}

// Helper function to validate image file types
func IsValidImageType(fileType string) bool {
	validTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/bmp",
		"image/tiff",
	}

	for _, validType := range validTypes {
		if strings.EqualFold(fileType, validType) {
			return true
		}
	}
	return false
}

// Helper function to get file size in MB
func GetFileSizeMB(size int64) float64 {
	return float64(size) / (1024 * 1024)
}
