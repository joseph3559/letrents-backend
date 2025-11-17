import { env } from '../config/env.js';

interface SignupNotificationData {
	name: string;
	email: string;
	phone_number?: string;
	role: string;
}

/**
 * Determines if the current environment is production based on APP_URL
 */
function isProduction(): boolean {
	const appUrl = env.appUrl.toLowerCase();
	// Production: https://letrents.com
	// Dev: https://dev.letrents.com
	return appUrl.includes('letrents.com') && !appUrl.includes('dev.letrents.com');
}

/**
 * Gets the appropriate Slack webhook URL based on environment
 */
function getSlackWebhookUrl(): string | null {
	if (isProduction()) {
		return env.slack?.prodSignupWebhookUrl || null;
	} else {
		return env.slack?.devSignupWebhookUrl || null;
	}
}

/**
 * Formats the role/type for display
 */
function formatRole(role: string): string {
	// Map roles to user-friendly names
	const roleMap: Record<string, string> = {
		landlord: 'Independent Landlord',
		agency_admin: 'Agency',
		tenant: 'Tenant',
		super_admin: 'Super Admin',
		agent: 'Agent',
		caretaker: 'Caretaker',
		admin: 'Admin',
		manager: 'Manager',
	};

	return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
}

/**
 * Sends a Slack notification for new user signups
 */
export async function sendSignupNotification(data: SignupNotificationData): Promise<{ success: boolean; error?: string }> {
	try {
		const webhookUrl = getSlackWebhookUrl();

		if (!webhookUrl) {
			console.warn('⚠️  Slack webhook URL not configured. Skipping notification.');
			return { success: false, error: 'Slack webhook URL not configured' };
		}

		const environment = isProduction() ? 'Production' : 'Development';
		const roleDisplay = formatRole(data.role);

		// Create a nicely formatted Slack message
		const slackPayload = {
			text: `🎉 New ${environment} Signup`,
			blocks: [
				{
					type: 'header',
					text: {
						type: 'plain_text',
						text: `🎉 New ${environment} Signup`,
						emoji: true,
					},
				},
				{
					type: 'divider',
				},
				{
					type: 'section',
					fields: [
						{
							type: 'mrkdwn',
							text: `*Name:*\n${data.name}`,
						},
						{
							type: 'mrkdwn',
							text: `*Email:*\n${data.email}`,
						},
						{
							type: 'mrkdwn',
							text: `*Phone:*\n${data.phone_number || 'Not provided'}`,
						},
						{
							type: 'mrkdwn',
							text: `*Type/Role:*\n${roleDisplay}`,
						},
					],
				},
				{
					type: 'divider',
				},
				{
					type: 'context',
					elements: [
						{
							type: 'mrkdwn',
							text: `📍 Environment: ${environment} | ⏰ ${new Date().toLocaleString()}`,
						},
					],
				},
			],
		};

		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(slackPayload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('❌ Failed to send Slack notification:', response.status, errorText);
			return { success: false, error: `Slack API error: ${response.status}` };
		}

		console.log(`✅ Slack notification sent successfully for ${data.email}`);
		return { success: true };
	} catch (error: any) {
		console.error('❌ Error sending Slack notification:', error);
		return { success: false, error: error.message || 'Unknown error' };
	}
}

