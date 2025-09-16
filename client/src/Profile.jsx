import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import API from './api';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await API.get('/profile');
        setProfile(response.data);
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>{error}</div>;
  if (!profile) return <div>No profile data</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Profile</h1>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <img
          src={profile.pic}
          alt="Profile"
          style={{ width: '100px', height: '100px', borderRadius: '50%', marginRight: '20px' }}
        />
        <div>
          <h2>{profile.name}</h2>
          <p>@{profile.username}</p>
          <p>{profile.email}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>Followers ({profile.followers.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {profile.followers.map(follower => (
              <li key={follower._id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <img
                  src={follower.pic}
                  alt={follower.name}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
                />
                <div>
                  <p style={{ margin: 0 }}>{follower.name}</p>
                  <small>@{follower.username}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Following ({profile.following.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {profile.following.map(following => (
              <li key={following._id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <img
                  src={following.pic}
                  alt={following.name}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
                />
                <div>
                  <p style={{ margin: 0 }}>{following.name}</p>
                  <small>@{following.username}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}