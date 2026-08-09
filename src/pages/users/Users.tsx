import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './Users.module.scss';

type User = {
  userId?: string;
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
};

const validRoles = ['A', 'B', 'C', 'D'] as const;

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('hbus_user_role');
    const userId = localStorage.getItem('hbus_user_id');

    if (!role || !['A', 'B', 'C'].includes(role)) {
      navigate('/');
      return;
    }

    setCurrentRole(role);
    setCurrentUserId(userId);
    loadUsers(role);
  }, [navigate]);

  const loadUsers = async (role: string) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
      const allUsers: User[] = response.data;
      const filtered = role === 'A'
        ? allUsers
        : role === 'B'
          ? allUsers.filter((user) => ['B', 'C', 'D'].includes(user.role ?? ''))
          : allUsers.filter((user) => ['C', 'D'].includes(user.role ?? ''));
      setUsers(filtered);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load users.');
    }
  };

  const canChangeRole = (target: User) => {
    if (!currentRole) {
      return false;
    }

    if (target.userId && target.userId === currentUserId) {
      return false;
    }

    if (target._id && target._id === currentUserId) {
      return false;
    }

    if (currentRole === 'A') {
      return true;
    }

    if (currentRole === 'B') {
      return ['C', 'D'].includes(target.role ?? '');
    }

    if (currentRole === 'C') {
      return target.role === 'D';
    }

    return false;
  };

  const allowedRoleOptions = (target: User) => {
    if (!currentRole) {
      return [];
    }

    if (currentRole === 'A') {
      return validRoles;
    }

    if (currentRole === 'B') {
      return ['B', 'C', 'D'];
    }

    if (currentRole === 'C') {
      return ['C', 'D'];
    }

    return [];
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    const id = user.userId ?? user._id;
    if (!id || !currentRole || !canChangeRole(user)) {
      return;
    }

    try {
      await axios.patch(`${import.meta.env.VITE_APP_API}/api/users/${id}`, { role: newRole });
      await loadUsers(currentRole);
    } catch (err) {
      console.error(err);
      setError('Role update failed.');
    }
  };

  return (
    <main className={styles.users}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h1>User Management</h1>
          <p>Manage user roles based on your current access level.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const role = user.role ?? 'D';
                const userKey = user.userId ?? user._id ?? user.email ?? Math.random().toString();
                return (
                  <tr key={userKey}>
                    <td>{user.name ?? 'Unknown'}</td>
                    <td>{user.email ?? 'Unknown'}</td>
                    <td>{role}</td>
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
                        <span className={styles.noAction}>No action</span>
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
