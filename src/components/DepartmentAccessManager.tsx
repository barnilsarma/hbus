import axios from 'axios';
import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';
import styles from './DepartmentAccessManager.module.scss';

type User = {
  userId?: string;
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  viewaccess?: string[];
  editaccess?: string[];
};

const getUserId = (user: User) => user.userId || user._id || user.id || '';

const hasDepartmentAccess = (access: string[] | undefined, department: string) =>
  (access ?? []).some((value) => value.trim().toLowerCase() === department.toLowerCase());

const getUsersFromResponse = (data: unknown): User[] => {
  if (Array.isArray(data)) return data as User[];
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data as User[];
  }
  throw new Error('User response was not a list.');
};

export default function DepartmentAccessManager({ department }: { department: string }) {
  const isAdmin = ['A', 'B'].includes(localStorage.getItem('hbus_user_role') || '');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewAccess, setViewAccess] = useState(false);
  const [editAccess, setEditAccess] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const openUserList = async () => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
      setUsers(getUsersFromResponse(response.data));
      setListOpen(true);
    } catch (error) {
      console.error(`Failed to load users for ${department} access management.`, error);
      toast.error('Failed to load user list.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const openUserAccess = (user: User) => {
    setSelectedUser(user);
    setViewAccess(hasDepartmentAccess(user.viewaccess, department));
    setEditAccess(hasDepartmentAccess(user.editaccess, department));
  };

  const closeUserAccess = () => setSelectedUser(null);

  const saveAccess = async () => {
    if (!selectedUser) return;
    const userId = getUserId(selectedUser);
    if (!userId) {
      toast.error('Invalid user selected.');
      return;
    }

    let hasView = hasDepartmentAccess(selectedUser.viewaccess, department);
    let hasEdit = hasDepartmentAccess(selectedUser.editaccess, department);
    const endpoint = `${import.meta.env.VITE_APP_API}/api/users/${encodeURIComponent(userId)}`;

    setSaving(true);
    try {
      if (!viewAccess && hasView) {
        await axios.delete(`${import.meta.env.VITE_APP_API}/api/users/revoke/${encodeURIComponent(userId)}`, {
          data: { department, access: 'view' },
        });
        hasView = false;
        hasEdit = false;
      } else if (viewAccess && !hasView) {
        await axios.patch(endpoint, { department, access: 'view' });
        hasView = true;
      }

      if (editAccess && !hasEdit) {
        await axios.patch(endpoint, { department, access: 'edit' });
        hasEdit = true;
      } else if (!editAccess && hasEdit) {
        await axios.delete(`${import.meta.env.VITE_APP_API}/api/users/revoke/${encodeURIComponent(userId)}`, {
          data: { department, access: 'edit' },
        });
        hasEdit = false;
      }

      setUsers((currentUsers) => currentUsers.map((user) => (
        getUserId(user) === userId
          ? {
            ...user,
            viewaccess: hasView
              ? [...(user.viewaccess ?? []).filter((value) => value.trim().toLowerCase() !== department.toLowerCase()), department]
              : (user.viewaccess ?? []).filter((value) => value.trim().toLowerCase() !== department.toLowerCase()),
            editaccess: hasEdit
              ? [...(user.editaccess ?? []).filter((value) => value.trim().toLowerCase() !== department.toLowerCase()), department]
              : (user.editaccess ?? []).filter((value) => value.trim().toLowerCase() !== department.toLowerCase()),
          }
          : user
      )));
      toast.success(`${department} access permissions updated.`);
      closeUserAccess();
    } catch (error) {
      console.error(`Failed to update ${department} access permissions.`, error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Failed to update access settings.'
        : 'Failed to update access settings.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className={styles.manageButton} onClick={() => void openUserList()} disabled={loadingUsers}>
        {loadingUsers ? 'Loading users...' : 'Manage Access'}
      </button>

      {listOpen && (
        <div className={styles.overlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setListOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="access-users-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="access-users-title">Manage {department} Access</h2>
                <p>Select a user to update their view and edit permissions.</p>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close user list" onClick={() => setListOpen(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <div className={styles.userList}>
              {users.length ? users.map((user, index) => (
                <div className={styles.userRow} key={getUserId(user) || user.email || index}>
                  <div className={styles.userDetails}>
                    <strong>{user.name || user.email || 'Unnamed user'}</strong>
                    {user.email && <span>{user.email}</span>}
                  </div>
                  <button type="button" className={styles.secondaryButton} onClick={() => openUserAccess(user)}>
                    Edit Access
                  </button>
                </div>
              )) : <p className={styles.emptyState}>No users found.</p>}
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setListOpen(false)}>Close</button>
            </footer>
          </section>
        </div>
      )}

      {selectedUser && (
        <div className={styles.overlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) closeUserAccess();
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="access-user-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="access-user-title">{userLabel(selectedUser)}: {department} Access</h2>
                <p>Choose the permissions this user should have.</p>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close access settings" onClick={closeUserAccess} disabled={saving}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <div className={styles.permissions}>
              <label>
                <input type="checkbox" checked={viewAccess} onChange={(event) => setViewAccess(event.target.checked)} />
                View access
              </label>
              <label>
                <input type="checkbox" checked={editAccess} onChange={(event) => setEditAccess(event.target.checked)} />
                Edit access
              </label>
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeUserAccess} disabled={saving}>Cancel</button>
              <button type="button" className={styles.saveButton} onClick={() => void saveAccess()} disabled={saving}>
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function userLabel(user: User) {
  return user.name || user.email || 'User';
}
