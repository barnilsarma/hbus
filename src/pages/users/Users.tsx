import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Users.module.scss';

type User = {
  userId?: string;
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
};

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('hbus_user_role');
    const userId = localStorage.getItem('hbus_user_id');

    if (!role || !['A', 'B'].includes(role)) {
      navigate('/');
      return;
    }

    setCurrentRole(role);
    setCurrentUserId(userId);
    loadUsers(role, userId!);
  }, [navigate]);

  const getUserId = (user: User) => user.userId ?? user._id ?? '';

  const loadUsers = async (role: string, userId: string) => {
    try {
      await toast.promise(
        (async () => {
          const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
          const allUsers: User[] = response.data;
          const filtered = allUsers.filter((user) => {
            const id = getUserId(user);
            if (role === 'A') {
              return id !== userId;
            }
            if (role === 'B') {
              return user.role !== 'A';
            }
            return false;
          });
          setUsers(filtered);
          setError(null);
        })(),
        {
          loading: 'Loading users...',
          success: 'Users loaded.',
          error: 'Failed to load users.',
        },
      );
    } catch {
      setError('Failed to load users.');
    }
  };

  const canChangeRole = (target: User) => {
    if (!currentRole) {
      return false;
    }

    if (getUserId(target) === currentUserId) {
      return false;
    }

    if (currentRole === 'A') {
      return true;
    }

    if (currentRole === 'B') {
      return ['C', 'D'].includes(target.role ?? '');
    }

    return false;
  };

  const allowedRoleOptions = (_target: User) => {
    if (!currentRole) {
      return [];
    }

    if (currentRole === 'A' || currentRole === 'B') {
      return ['B', 'C', 'D'];
    }

    return [];
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    const id = getUserId(user);
    if (!id || !currentRole || !canChangeRole(user)) {
      return;
    }

    try {
      await toast.promise(
        (async () => {
          await axios.put(`${import.meta.env.VITE_APP_API}/api/users/${id}`, { role: newRole });
          if (currentRole && currentUserId) {
            await loadUsers(currentRole, currentUserId);
          }
        })(),
        {
          loading: 'Updating role...',
          success: 'Role updated.',
          error: 'Role update failed.',
        },
      );
    } catch {
      setError('Role update failed.');
    }
  };

  return (
    <main className={styles.users}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h1>User Management</h1>
          <p>Manage user roles and department access for C/D users.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const role = user.role ?? 'D';
            const userKey = getUserId(user) || Math.random().toString();
            return (
              <tr key={userKey}>
                <td>{user.name ?? 'Unknown'}</td>
                <td>{user.email ?? 'Unknown'}</td>
                <td>
                  {canChangeRole(user) ? (
                    <select
                      value={role}
                      onChange={(event) => handleRoleChange(user, event.target.value)}
                      className={styles.roleSelect}
                    >
                      {allowedRoleOptions(user).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    role
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
        </div>
      </section>
    </main>
  );
};

export default Users;
