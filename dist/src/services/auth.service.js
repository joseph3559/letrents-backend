import { getPrisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from './email.service.js';
export class AuthService {
    prisma = getPrisma();
    generateJwt(user, sessionId, permissions = []) {
        const expiresAt = new Date(Date.now() + env.jwt.expHours * 60 * 60 * 1000);
        const claims = {
            user_id: user.id,
            email: user.email || '',
            phone_number: user.phone_number || '',
            role: user.role,
            company_id: user.company_id || null,
            agency_id: user.agency_id || null,
            landlord_id: user.landlord_id || null,
            session_id: sessionId,
            permissions,
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
            iss: env.jwt.issuer,
            sub: user.id,
            // aud: env.jwt.audience,
        };
        const token = jwt.sign(claims, env.jwt.secret);
        return { token, expiresAt };
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    async createRefreshToken(userId, deviceInfo, ip, ua, hours) {
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = this.hashToken(raw);
        const expiresAt = new Date(Date.now() + (hours ? hours : env.jwt.refreshExpHours) * 60 * 60 * 1000);
        await this.prisma.refreshToken.create({
            data: {
                user_id: userId,
                token_hash: tokenHash,
                device_info: deviceInfo ? deviceInfo : undefined,
                ip_address: ip || undefined,
                user_agent: ua || undefined,
                expires_at: expiresAt,
                is_revoked: false,
            },
        });
        return { token: raw, expiresAt };
    }
    async register(payload) {
        const role = (payload.role || 'tenant');
        // Uniqueness checks
        // Handle invitation tokens for existing users
        if (payload.invitation_token && payload.invitation_token.startsWith('invitation-')) {
            const tenantId = payload.invitation_token.replace('invitation-', '');
            const existingTenant = await this.prisma.user.findUnique({
                where: { id: tenantId }
            });
            // Verify the tenant exists, has the correct email, role, and is pending
            if (existingTenant &&
                existingTenant.email === payload.email &&
                existingTenant.role === 'tenant' &&
                existingTenant.status === 'pending') {
                // Update existing tenant with password and activate account
                const password_hash = payload.password ? await bcrypt.hash(payload.password, 10) : null;
                const updatedUser = await this.prisma.user.update({
                    where: { id: tenantId },
                    data: {
                        password_hash,
                        status: 'active',
                        email_verified: true,
                        updated_at: new Date(),
                    },
                });
                // Auto-login the updated user
                const sessionId = crypto.randomUUID();
                const { token, expiresAt } = this.generateJwt(updatedUser, sessionId);
                const refresh = await this.createRefreshToken(updatedUser.id, undefined, undefined, undefined, env.security.sessionTimeoutHours);
                return { token, refresh_token: refresh.token, user: updatedUser, expires_at: expiresAt };
            }
            else if (existingTenant) {
                // Tenant exists but doesn't match criteria
                if (existingTenant.email !== payload.email) {
                    throw new Error('invitation token does not match the provided email address');
                }
                if (existingTenant.role !== 'tenant') {
                    throw new Error('invalid invitation token for tenant registration');
                }
                if (existingTenant.status !== 'pending') {
                    throw new Error('this invitation has already been used or the account is already active');
                }
            }
            else {
                // Tenant not found
                throw new Error('invalid or expired invitation token');
            }
        }
        // Validate email uniqueness for new users
        if (payload.email) {
            const existing = await this.prisma.user.findUnique({ where: { email: payload.email } });
            if (existing)
                throw new Error('email already exists');
        }
        const password_hash = payload.password ? await bcrypt.hash(payload.password, 10) : null;
        let company_id = null;
        if (role === 'landlord' || role === 'agency_admin') {
            const companyName = payload.company_name || `${payload.first_name} ${payload.last_name} ${role === 'agency_admin' ? 'Agency' : 'Properties'}`;
            const existingCompany = await this.prisma.company.findFirst({ where: { name: companyName } }).catch(() => null);
            if (existingCompany) {
                company_id = existingCompany.id;
            }
            else {
                const company = await this.prisma.company.create({
                    data: {
                        name: companyName,
                        business_type: payload.business_type || 'property_management',
                        country: 'Kenya',
                        industry: 'Property Management',
                        company_size: 'small',
                        status: 'active',
                        subscription_plan: 'starter',
                        max_properties: 100,
                        max_units: 1000,
                        max_tenants: 1000,
                        max_staff: 50,
                    },
                });
                company_id = company.id;
            }
        }
        const user = await this.prisma.user.create({
            data: {
                email: payload.email,
                password_hash,
                first_name: payload.first_name,
                last_name: payload.last_name,
                phone_number: payload.phone_number || undefined,
                role,
                status: env.security.requireEmailVerification ? 'pending' : 'active',
                email_verified: !env.security.requireEmailVerification,
                company_id: company_id || undefined,
            },
        });
        if (env.security.requireEmailVerification && payload.email) {
            // create email verification token
            const raw = crypto.randomBytes(32).toString('hex');
            await this.prisma.emailVerificationToken.create({
                data: {
                    user_id: user.id,
                    token_hash: this.hashToken(raw),
                    email: user.email,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    is_used: false,
                },
            });
            // Send email verification using email service
            const verificationUrl = `${env.appUrl}/verify-email?token=${raw}`;
            try {
                const emailResult = await emailService.sendVerificationEmail(user.email, verificationUrl, `${user.first_name} ${user.last_name}`);
                if (!emailResult.success) {
                    console.error('Failed to send verification email:', emailResult.error);
                    // Log verification link to console as fallback
                    console.log('\n🔗 EMAIL VERIFICATION LINK (email service failed):');
                    console.log(`📧 Email: ${user.email}`);
                    console.log(`🔗 Verification URL: ${verificationUrl}`);
                    console.log('👆 Click this link to verify the account\n');
                }
                else {
                    console.log(`✅ Verification email sent successfully to ${user.email}`);
                }
            }
            catch (error) {
                console.error('Error sending verification email:', error);
                // Log verification link to console as fallback
                console.log('\n🔗 EMAIL VERIFICATION LINK (email service error):');
                console.log(`📧 Email: ${user.email}`);
                console.log(`🔗 Verification URL: ${verificationUrl}`);
                console.log('👆 Click this link to verify the account\n');
            }
            return { user, requires_mfa: true, mfa_methods: ['email'] };
        }
        // autologin path (no email verification required)
        const sessionId = crypto.randomUUID();
        const { token, expiresAt } = this.generateJwt(user, sessionId);
        const refresh = await this.createRefreshToken(user.id, undefined, undefined, undefined, env.security.sessionTimeoutHours);
        return { token, refresh_token: refresh.token, user, expires_at: expiresAt };
    }
    async verifyEmail(token) {
        const tokenHash = this.hashToken(token);
        // First check if token exists (used or unused)
        const tokenRecord = await this.prisma.emailVerificationToken.findFirst({
            where: { token_hash: tokenHash },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        email_verified: true,
                        status: true
                    }
                }
            }
        });
        if (!tokenRecord) {
            throw new Error('invalid or expired verification token');
        }
        // Check if user is already verified
        if (tokenRecord.user.email_verified) {
            return {
                message: 'Email has already been verified. You can now log in to your account.',
                already_verified: true,
                user: {
                    email: tokenRecord.user.email,
                    role: tokenRecord.user.role
                }
            };
        }
        // Check if token is already used
        if (tokenRecord.is_used) {
            throw new Error('verification token has already been used');
        }
        // Check if token is expired
        if (tokenRecord.expires_at && tokenRecord.expires_at < new Date()) {
            throw new Error('verification token is expired');
        }
        // Verify the email
        await this.prisma.user.update({
            where: { id: tokenRecord.user_id },
            data: { email_verified: true, status: 'active' }
        });
        await this.prisma.emailVerificationToken.updateMany({
            where: { token_hash: tokenHash },
            data: { is_used: true, used_at: new Date() }
        });
        return {
            message: 'Email verified successfully',
            user: {
                email: tokenRecord.user.email,
                role: tokenRecord.user.role
            }
        };
    }
    async login(payload, ip, ua) {
        if (!payload.email || !payload.password)
            throw new Error('invalid credentials');
        const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
        if (!user)
            throw new Error('user not found');
        // Allow 'active' and 'pending_setup' users to log in
        // 'pending_setup' users can log in to complete their account setup (change password, etc.)
        const allowedStatuses = ['active', 'pending_setup'];
        if (!allowedStatuses.includes(user.status)) {
            throw new Error('user account is inactive');
        }
        if (!user.password_hash)
            throw new Error('invalid credentials');
        const ok = await bcrypt.compare(payload.password, user.password_hash);
        if (!ok)
            throw new Error('invalid credentials');
        if (env.security.requireEmailVerification && !user.email_verified)
            throw new Error('user account is not verified');
        // Update last_login_at timestamp
        await this.prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() }
        });
        const sessionId = crypto.randomUUID();
        const { token, expiresAt } = this.generateJwt(user, sessionId);
        const refreshHours = payload.remember_me ? env.jwt.refreshExpHours : env.security.sessionTimeoutHours;
        const refresh = await this.createRefreshToken(user.id, payload.device_info, ip, ua, refreshHours);
        // Return user status so frontend can handle pending_setup users appropriately
        return {
            token,
            refresh_token: refresh.token,
            user: {
                ...user,
                last_login_at: new Date() // Include updated timestamp in response
            },
            expires_at: expiresAt,
            requires_password_change: user.status === 'pending_setup'
        };
    }
    async refresh(refreshToken, ip, ua) {
        const tokenHash = this.hashToken(refreshToken);
        const rec = await this.prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
        if (!rec || rec.is_revoked)
            throw new Error('invalid token');
        if (rec.expires_at < new Date())
            throw new Error('token expired');
        const user = await this.prisma.user.findUnique({ where: { id: rec.user_id } });
        if (!user)
            throw new Error('user not found');
        if (user.status !== 'active')
            throw new Error('user account is inactive');
        const sessionId = crypto.randomUUID();
        const { token, expiresAt } = this.generateJwt(user, sessionId);
        return { token, refresh_token: refreshToken, user, expires_at: expiresAt };
    }
    async requestPasswordReset(email) {
        // Find user by email
        const user = await this.prisma.user.findUnique({ where: { email } });
        // Always return success for security (don't reveal if email exists)
        if (!user) {
            return {
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            };
        }
        // Generate reset token
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = this.hashToken(raw);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Store reset token
        // TODO: Fix token model schema
        // await this.prisma.passwordResetToken.create({
        // 	data: {
        // 		user_id: user.id,
        // 		email: user.email!,
        // 		token_hash: tokenHash,
        // 		expires_at: expiresAt,
        // 		is_used: false,
        // 	},
        // });
        // Send password reset email
        const resetUrl = `${env.appUrl}/reset-password?token=${raw}`;
        try {
            const emailResult = await emailService.sendPasswordResetEmail(user.email, resetUrl, `${user.first_name} ${user.last_name}`);
            if (!emailResult.success) {
                console.error('Failed to send password reset email:', emailResult.error);
                // Log reset link to console as fallback
                console.log('\n🔗 PASSWORD RESET LINK (email service failed):');
                console.log(`📧 Email: ${user.email}`);
                console.log(`🔗 Reset URL: ${resetUrl}`);
                console.log('👆 Use this link to reset the password\n');
            }
            else {
                console.log(`✅ Password reset email sent successfully to ${user.email}`);
            }
        }
        catch (error) {
            console.error('Error sending password reset email:', error);
            // Log reset link to console as fallback
            console.log('\n🔗 PASSWORD RESET LINK (email service error):');
            console.log(`📧 Email: ${user.email}`);
            console.log(`🔗 Reset URL: ${resetUrl}`);
            console.log('👆 Use this link to reset the password\n');
        }
        return {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        };
    }
    async resetPassword(token, newPassword) {
        const tokenHash = this.hashToken(token);
        const rec = await this.prisma.passwordResetToken.findFirst({
            where: { token_hash: tokenHash, is_used: false }
        });
        if (!rec)
            throw new Error('invalid or expired reset token');
        if (rec.expires_at && rec.expires_at < new Date())
            throw new Error('reset token is expired');
        // Hash new password
        const password_hash = await bcrypt.hash(newPassword, 10);
        // Update user password and mark token as used
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: rec.user_id },
                data: { password_hash }
            }),
            this.prisma.passwordResetToken.updateMany({
                where: { token_hash: tokenHash },
                data: { is_used: true, used_at: new Date() }
            }),
            // Revoke all refresh tokens for security
            this.prisma.refreshToken.updateMany({
                where: { user_id: rec.user_id },
                data: { is_revoked: true }
            })
        ]);
    }
    async resendVerificationEmail(email) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        if (user.email_verified) {
            return {
                success: false,
                message: 'Email is already verified'
            };
        }
        // Generate new verification token
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = this.hashToken(raw);
        // Invalidate old tokens and create new one
        await this.prisma.$transaction([
            this.prisma.emailVerificationToken.updateMany({
                where: { user_id: user.id, is_used: false },
                data: { is_used: true, used_at: new Date() }
            }),
            this.prisma.emailVerificationToken.create({
                data: {
                    user_id: user.id,
                    token_hash: tokenHash,
                    email: user.email,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    is_used: false,
                },
            })
        ]);
        // Send verification email
        const verificationUrl = `${env.appUrl}/verify-email?token=${raw}`;
        try {
            const emailResult = await emailService.sendVerificationEmail(user.email, verificationUrl, `${user.first_name} ${user.last_name}`);
            if (!emailResult.success) {
                console.error('Failed to resend verification email:', emailResult.error);
                return {
                    success: false,
                    message: 'Failed to send verification email'
                };
            }
            else {
                console.log(`✅ Verification email resent successfully to ${user.email}`);
                return {
                    success: true,
                    message: 'Verification email sent successfully'
                };
            }
        }
        catch (error) {
            console.error('Error resending verification email:', error);
            return {
                success: false,
                message: 'Failed to send verification email'
            };
        }
    }
}
