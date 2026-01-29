import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Folder: a
    .model({
      name: a.string().required(),
      parentFolderId: a.id(),
      path: a.string().required(),
      size: a.integer(), // Add size field for folder
    })
    .authorization((allow) => [allow.owner()]),

  FileMetadata: a
    .model({
      fileName: a.string().required(),
      fileSize: a.integer().required(),
      s3Key: a.string().required(),
      mimeType: a.string(),
      folderId: a.id(),
      folderPath: a.string(),

      // Versioning and Sync fields
      lastModified: a.timestamp(),
      isDeleted: a.boolean(), // Soft delete flag
      owner: a.string(), // Explicitly defined to ensure Trigger can write to it matchingly
      version: a.integer(), // Version number (starts at 1)
    })
    .authorization((allow) => [allow.owner()]),
  UserProfile: a
    .model({
      displayName: a.string(),
      email: a.string(),
      plan: a.enum(['FREE', 'PREMIUM']),
      avatarUrl: a.string(),
      storageUsed: a.integer().default(0),
    })
    .authorization((allow) => [allow.owner()]),
  ShareLink: a
    .model({
      fileId: a.string().required(), // Reference to FileMetadata.id
      s3Key: a.string().required(), // Cached S3 Key for presigning
      fileName: a.string(),
      passwordHash: a.string(), // Optional: only if password protected
      expiresAt: a.datetime(),
      visitCount: a.integer().default(0),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.publicApiKey().to(['read', 'update']), // Public can read to check and update visit count
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});