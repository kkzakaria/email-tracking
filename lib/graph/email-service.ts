import { Client } from "@microsoft/microsoft-graph-client";
import { Message, User } from "@microsoft/microsoft-graph-types";
import { createGraphClient, createGraphClientWithToken } from "./client";

export interface EmailMessage {
  id: string;
  messageId: string;
  conversationId: string;
  subject: string;
  from: string;
  to: string[];
  sentDateTime: string;
  receivedDateTime?: string;
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

export class EmailService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Get the current user's profile
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await this.client.api("/me").get();
      return user;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }

  /**
   * Get sent emails from the user's mailbox
   */
  async getSentEmails(limit: number = 50): Promise<EmailMessage[]> {
    try {
      const response = await this.client
        .api("/me/mailFolders/sentitems/messages")
        .top(limit)
        .select("id,internetMessageId,conversationId,subject,from,toRecipients,sentDateTime,bodyPreview,hasAttachments,isRead")
        .orderby("sentDateTime desc")
        .get();

      return response.value.map(this.mapToEmailMessage);
    } catch (error) {
      console.error("Error fetching sent emails:", error);
      return [];
    }
  }

  /**
   * Get emails from inbox
   */
  async getInboxEmails(limit: number = 50): Promise<EmailMessage[]> {
    try {
      const response = await this.client
        .api("/me/mailFolders/inbox/messages")
        .top(limit)
        .select("id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead")
        .orderby("receivedDateTime desc")
        .get();

      return response.value.map(this.mapToEmailMessage);
    } catch (error) {
      console.error("Error fetching inbox emails:", error);
      return [];
    }
  }

  /**
   * Get emails by conversation ID to check for replies
   */
  async getEmailsByConversation(conversationId: string): Promise<EmailMessage[]> {
    try {
      const response = await this.client
        .api("/me/messages")
        .filter(`conversationId eq '${conversationId}'`)
        .select("id,internetMessageId,conversationId,subject,from,toRecipients,sentDateTime,receivedDateTime,bodyPreview,hasAttachments,isRead")
        .orderby("receivedDateTime desc")
        .get();

      return response.value.map(this.mapToEmailMessage);
    } catch (error) {
      console.error("Error fetching conversation emails:", error);
      return [];
    }
  }

  /**
   * Search emails by subject
   */
  async searchEmailsBySubject(subject: string): Promise<EmailMessage[]> {
    try {
      const response = await this.client
        .api("/me/messages")
        .filter(`contains(subject, '${subject}')`)
        .top(25)
        .select("id,internetMessageId,conversationId,subject,from,toRecipients,sentDateTime,receivedDateTime,bodyPreview,hasAttachments,isRead")
        .orderby("receivedDateTime desc")
        .get();

      return response.value.map(this.mapToEmailMessage);
    } catch (error) {
      console.error("Error searching emails:", error);
      return [];
    }
  }

  /**
   * Send an email
   */
  async sendEmail(params: SendEmailParams): Promise<boolean> {
    try {
      const message: Message = {
        subject: params.subject,
        body: {
          contentType: params.isHtml ? "html" : "text",
          content: params.body,
        },
        toRecipients: params.to.map(email => ({
          emailAddress: { address: email }
        })),
      };

      await this.client
        .api("/me/sendMail")
        .post({ message });

      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }

  /**
   * Send an email with tracking pixel
   */
  async sendEmailWithTracking(params: SendEmailParams, trackingId: string): Promise<boolean> {
    try {
      // Add tracking pixel to HTML body
      let body = params.body;
      if (params.isHtml) {
        const pixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/pixel/${trackingId}`;
        const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
        
        // Insert before closing body tag if exists, otherwise append
        if (body.includes("</body>")) {
          body = body.replace("</body>", `${trackingPixel}</body>`);
        } else {
          body = `${body}${trackingPixel}`;
        }
      }

      const message: Message = {
        subject: params.subject,
        body: {
          contentType: params.isHtml ? "html" : "text",
          content: body,
        },
        toRecipients: params.to.map(email => ({
          emailAddress: { address: email }
        })),
      };

      const response = await this.client
        .api("/me/sendMail")
        .post({ message, saveToSentItems: true });

      return true;
    } catch (error) {
      console.error("Error sending email with tracking:", error);
      return false;
    }
  }

  /**
   * Reply to an email
   */
  async replyToEmail(messageId: string, replyBody: string, replyAll: boolean = false): Promise<boolean> {
    try {
      const endpoint = replyAll ? `/me/messages/${messageId}/replyAll` : `/me/messages/${messageId}/reply`;
      
      await this.client
        .api(endpoint)
        .post({
          comment: replyBody,
        });

      return true;
    } catch (error) {
      console.error("Error replying to email:", error);
      return false;
    }
  }

  /**
   * Map Microsoft Graph message to our EmailMessage interface
   */
  private mapToEmailMessage(message: any): EmailMessage {
    return {
      id: message.id,
      messageId: message.internetMessageId || "",
      conversationId: message.conversationId || "",
      subject: message.subject || "",
      from: message.from?.emailAddress?.address || "",
      to: (message.toRecipients || []).map((r: any) => r.emailAddress?.address || ""),
      sentDateTime: message.sentDateTime || "",
      receivedDateTime: message.receivedDateTime,
      bodyPreview: message.bodyPreview || "",
      hasAttachments: message.hasAttachments || false,
      isRead: message.isRead || false,
    };
  }
}

/**
 * Factory function to create an EmailService instance
 */
export async function createEmailService(): Promise<EmailService | null> {
  const client = await createGraphClient();
  if (!client) {
    return null;
  }
  return new EmailService(client);
}

/**
 * Factory function to create an EmailService instance with token
 */
export function createEmailServiceWithToken(accessToken: string): EmailService {
  const client = createGraphClientWithToken(accessToken);
  return new EmailService(client);
}