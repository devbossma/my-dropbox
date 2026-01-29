import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'dropbox-storage',
    access: (allow) => ({
        'user-files/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete'])
        ],
        'avatars/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete']),
            allow.guest.to(['read']),
            allow.authenticated.to(['read'])
        ],
        'shared-files/*': [
            allow.authenticated.to(['read', 'write', 'delete']), // Owners can put files here
            allow.guest.to(['read']) // Guests can read shared files
        ]
    })
});
