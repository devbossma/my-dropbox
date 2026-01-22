import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Folder: a
    .model({
      name: a.string().required(),
      parentFolderId: a.id(), // Use a.id() instead of a.string() for references
      path: a.string().required(),
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
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});