import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'dropbox-storage',
    access: (allow) => ({
        'user-files/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write', 'delete'])
        ]
    })
});
