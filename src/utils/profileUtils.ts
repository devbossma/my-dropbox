import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface UserProfileData {
    id: string;
    displayName?: string | null;
    email?: string | null;
    plan?: 'FREE' | 'PREMIUM' | null;
    avatarUrl?: string | null;
    storageUsed?: number | null;
    owner?: string | null;
}

export const getOrCreateProfile = async (user: { username: string; userId?: string; email?: string }): Promise<UserProfileData | null> => {
    try {
        // 1. Try to fetch existing profile
        const { data: profiles } = await client.models.UserProfile.list();

        // Since we use allow.owner(), list() only returns the current user's profiles
        // There should ideally be only one.
        if (profiles.length > 0) {
            return profiles[0];
        }

        // 2. If no profile exists, create one
        // Note: We don't manually set 'owner', Amplify handles it.
        const { data: newProfile, errors } = await client.models.UserProfile.create({
            displayName: user.username,
            email: user.email || user.username, // Fallback if email not directly available
            plan: 'FREE',
            storageUsed: 0,
            avatarUrl: '',
        });

        if (errors) {
            console.error('Error creating profile:', errors);
            throw new Error('Failed to create user profile');
        }

        return newProfile;
    } catch (err) {
        console.error('Error in getOrCreateProfile:', err);
        return null;
    }
};
