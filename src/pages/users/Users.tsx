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

type AccessState = {
  view: boolean;
  edit: boolean;
  department: string;
};

const departments = ['PURCHASE ORDER'];
const validRoles = ['A', 'B', 'C', 'D'] as const;

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessMap, setAccessMap] = useState<Record<string, AccessState>>({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedAccess, setSelectedAccess] = useState<{ view: boolean; edit: boolean }>({ view: false, edit: false });

  useEffect(() => {
    const role = localStorage.getItem('hbus_user_role');
    const userId = localStorage.getItem('hbus_user_id');

    if (!role || !['A', 'B'].includes(role)) {
      navigate('/');
      return;
    }

    setCurrentRole(role);
    setCurrentUserId(userId);
    loadUsers(role, userId);
  }, [navigate]);

  const getUserId = (user: User) => user.userId ?? user._id ?? user.email ?? '';

  const loadUsers = async (role: string, userId: string | null) => {
    try {
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
    } catch (err) {
      console.error(err);
      setError('Failed to load users.');
    }
  };

  const getAccessKey = (user: User, department: string) => `${getUserId(user)}:${department}`;

  const getStoredAccess = (user: User, department: string) => {
    return accessMap[getAccessKey(user, department)] ?? null;
  };

  const openAccessModal = (user: User, department: string) => {
    const stored = getStoredAccess(user, department);
    const defaultAccess = user.role === 'C'
      ? { view: true, edit: true }
      : { view: false, edit: false };

    const initialAccess = stored ? { view: stored.view, edit: stored.edit } : defaultAccess;
    if (initialAccess.edit && !initialAccess.view) {
      initialAccess.view = true;
    }

    setSelectedUser(user);
    setSelectedDepartment(department);
    setSelectedAccess(initialAccess);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setSelectedDepartment('');
    setSelectedAccess({ view: false, edit: false });
  };

  const saveAccess = () => {
    if (!selectedUser || !selectedDepartment) {
      return;
    }

    const key = getAccessKey(selectedUser, selectedDepartment);
    setAccessMap((prev) => ({
      ...prev,
      [key]: {
        department: selectedDepartment,
        view: selectedAccess.view,
        edit: selectedAccess.edit,
      },
    }));
    closeModal();
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

  const allowedRoleOptions = (target: User) => {
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
      await axios.put(`${import.meta.env.VITE_APP_API}/api/users/${id}`, { role: newRole });
      await loadUsers(currentRole, currentUserId);
    } catch (err) {
      console.error(err);
      setError('Role update failed.');
    }
  };

  const getAccessSummary = (user: User) => {
    const department = departments[0];
    const access = getStoredAccess(user, department);
    if (!access) {
      return 'Department not assigned';
    }
    const granted = [];
    if (access.view) granted.push('VIEW');
    if (access.edit) granted.push('EDIT');
    return granted.length > 0 ? `${department}: ${granted.join(', ')}` : `${department}: No access`;
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
                <th>Department Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const role = user.role ?? 'D';
                const userKey = getUserId(user) || Math.random().toString();
                const isRestrictedUser = ['C', 'D'].includes(role);
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
                    <td>{isRestrictedUser ? getAccessSummary(user) : 'Full access'}</td>
                    <td>
                      {isRestrictedUser && currentRole ? (
                        <select
                          value=""
                          onChange={(event) => openAccessModal(user, event.target.value)}
                          className={styles.roleSelect}
                        >
                          <option value="">Select department</option>
                          {departments.map((department) => (
                            <option key={department} value={department}>
                              {department}
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

      {selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Access</h2>
                <p>
                  Manage access for {selectedUser.name ?? selectedUser.email} in {selectedDepartment}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>

            <div className={styles.checkboxGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedAccess.view}
                  disabled={selectedAccess.edit}
                  onChange={(event) => setSelectedAccess((prev) => ({ ...prev, view: event.target.checked }))}
                />
                View
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={selectedAccess.edit}
                  onChange={(event) => {
                    const editChecked = event.target.checked;
                    setSelectedAccess((prev) => ({
                      view: editChecked ? true : prev.view,
                      edit: editChecked,
                    }));
                  }}
                />
                Edit
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={saveAccess}>
                Save access
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Users;
