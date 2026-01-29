# The following list is about some requirments should be exist or enhanced:
## Missing Features:
1. Add profile page where the user  can see and edit his profile.
2. Add a preview of the file should be shown when the user clicks on the file.
3. Add shared link with an encrypted URL. 
4. Add a expiration date system on the shared link.
5. shared links they should be checked if the expiration date is been set and has passed or not before password check. if the expiration date has passed, the link should not be accessible anymore. 

## Enhanced Features:
No Test Coverage - Missing unit tests for Lambda handlers and frontend components
No File Sharing - Missing shareable links with permissions/expiration (core Dropbox feature)
Folder Rename Limitation - Only works for empty folders; should support recursive path updates

## UI/UX Features to Update:
Hardcoded Storage Display - Shows "14.2 GB / 20 GB" instead of actual usage on the profile page annd sidebar.
Lambda Error Handling - No dead-letter queues or retry policies for failed operations.