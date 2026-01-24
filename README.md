# Welcome to My Backend Dropbox
***

## Task
The challenge was to build a full-stack, scalable file management system (Dropbox clone) that handles secure file uploads, real-time metadata synchronization, and hierarchical folder management. Key technical challenges included seamless integration between S3 storage and DynamoDB metadata, implementing custom backend triggers for object-metadata parity, and delivering a premium, brand-aligned user experience.

## Description
The project is built using **React + Vite** on the frontend and **AWS Amplify Gen 2** for a robust, serverless backend.

### Backend Architecture (@amplify)
- **Data (DynamoDB)**: Managed via Amplify Data, defining schemas for `Folder` and `FileMetadata`. It uses owner-based authorization to ensure users only access their own files.
- **Storage (S3)**: A secure bucket for storing actual files, integrated with the app's identity system.
- **Functions (Lambda Triggers)**:
    - **`s3-trigger`**: Detects S3 uploads and automatically populates DynamoDB records.
    - **`dynamo-trigger`**: Listens to DynamoDB changes (Rename/Delete) and synchronizes the S3 objects accordingly.

### Frontend Features
- **Real-time Sync**: Automatic UI updates when files change via Amplify observers.
- **Toast Notifications**: Built-in "flush" notification system for immediate user feedback.
- **Folder Management**: Advanced folder navigation with recursive size calculation and safe deletion checks.
- **Themed UI**: A deep-dark premium theme with customized Amplify Authenticator components.

## Installation
```bash
npm install
```

## Usage
Start the local development server:
```bash
npm run dev
```

### The Core Team


<span><i>Made at <a href='https://qwasar.io'>Qwasar SV -- Software Engineering School</a></i></span>
<span><img alt='Qwasar SV -- Software Engineering School's Logo' src='https://storage.googleapis.com/qwasar-public/qwasar-logo_50x50.png' width='20px' /></span>
