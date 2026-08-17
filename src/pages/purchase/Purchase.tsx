import axios from 'axios';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Purchase.module.scss';

type User = {
  userId?: string;
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  viewaccess?: string[];
  editaccess?: string[];
};

const getEntityId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const entity = value as { userId?: unknown; _id?: unknown; id?: unknown };
    if (typeof entity.userId === 'string') {
      return entity.userId;
    }
    if (typeof entity._id === 'string') {
      return entity._id;
    }
    if (typeof entity.id === 'string') {
      return entity.id;
    }
  }

  return null;
};

const hasDepartmentAccess = (access: string[] | undefined, department: string) => (
  (access ?? []).some((departmentName) => departmentName.trim().toLowerCase() === department.trim().toLowerCase())
);

const PURCHASE_DEPARTMENT = 'Purchase';

type PurchaseItem = {
  _id?: string;
  id?: string;
  PONumber: string;
  supplier?: string;
  item?: string;
  gst?: number;
  unit?: string;
  rate?: number;
  qty?: number;
  date?: string;
  status?: string;
  amount?: number;
  invoicenumber?: string;
  invoicedate?: string;
  receiptdate?: string;
  receivedqty?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

const visibleFields = [
  'PONumber',
  'supplier',
  'item',
  'gst',
  'unit',
  'rate',
  'qty',
  'date',
  'status',
  'amount',
  'invoicenumber',
  'invoicedate',
  'receiptdate',
  'receivedqty',
];

const statusOptions = ['INCOMPLETE', 'DELAYED', 'COMPLETE'] as const;

const fieldDefinitions = [
  { name: 'PONumber', label: 'PO Number', type: 'text', required: true },
  { name: 'supplier', label: 'Supplier', type: 'text' },
  { name: 'item', label: 'Item', type: 'text' },
  { name: 'gst', label: 'GST (%)', type: 'number' },
  { name: 'unit', label: 'Unit', type: 'text' },
  { name: 'rate', label: 'Rate', type: 'number' },
  { name: 'qty', label: 'Quantity', type: 'number' },
  { name: 'date', label: 'Order Date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select' },
  { name: 'amount', label: 'Amount', type: 'number' },
  { name: 'invoicenumber', label: 'Invoice Number', type: 'text' },
  { name: 'invoicedate', label: 'Invoice Date', type: 'date' },
  { name: 'receiptdate', label: 'Receipt Date', type: 'text' },
  { name: 'receivedqty', label: 'Received Quantity', type: 'number' },
] as const;

const fieldLabelMap = Object.fromEntries(fieldDefinitions.map((field) => [field.name, field.label]));

const formatCellValue = (field: string, value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if ((field === 'date' || field === 'invoicedate') && typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  return String(value);
};

const normalizeFieldValue = (field: string, value: string) => {
  if (value === '') {
    return undefined;
  }

  const definition = fieldDefinitions.find((item) => item.name === field);
  if (definition?.type === 'number') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return value;
};

const Purchase = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<PurchaseItem | null>(null);
  const [editField, setEditField] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showAccessCheckModal, setShowAccessCheckModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewAccess, setViewAccess] = useState(false);
  const [editAccess, setEditAccess] = useState(false);

  const role = localStorage.getItem('hbus_user_role');
  const canEdit = role === 'A' || role === 'B';
  const selectedUserHasViewAccess = Boolean(
    selectedUser && hasDepartmentAccess(selectedUser.viewaccess, PURCHASE_DEPARTMENT),
  );
  const selectedUserHasEditAccess = Boolean(
    selectedUser && hasDepartmentAccess(selectedUser.editaccess, PURCHASE_DEPARTMENT),
  );

  const columns = visibleFields;

  const loadPurchases = async () => {
    setLoading(true);
    try {
      await toast.promise(
        (async () => {
          const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/purchases`);
          setPurchases(Array.isArray(response.data) ? response.data : []);
          setError(null);
        })(),
        {
          loading: 'Loading purchases...',
          success: 'Purchase items loaded.',
          error: 'Failed to load purchases.',
        },
      );
    } catch {
      setError('Unable to load purchases.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
      const allUsers = Array.isArray(response.data) ? response.data as User[] : [];
      setUsers(allUsers.filter((user) => user.role === 'C' || user.role === 'D'));
    } catch {
      toast.error('Failed to load users.');
    }
  };

  const openManageAccess = async () => {
    setShowAccessModal(true);
    await loadUsers();
  };

  const openAccessModal = async (user: User) => {
    const userId = getEntityId(user);
    if (!userId) {
      toast.error('Unable to identify the user.');
      return;
    }

    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users/${userId}`);
      const userData = response.data as User;
      setSelectedUser(userData);
      setViewAccess(hasDepartmentAccess(userData.viewaccess, PURCHASE_DEPARTMENT));
      setEditAccess(hasDepartmentAccess(userData.editaccess, PURCHASE_DEPARTMENT));
      setShowAccessCheckModal(true);
    } catch {
      toast.error('Failed to load user access.');
    }
  };

  const closeAccessCheckModal = () => {
    setShowAccessCheckModal(false);
    setSelectedUser(null);
    setViewAccess(false);
    setEditAccess(false);
  };

  // --- HIGHLIGHT: Rewritten saveAccessChanges function ---
  // 1. Removed the strict block that returned early and prevented API calls if an uncheck happened.
  // 2. Safely captures "adds" and executes them, while warning the user if they attempted a "remove" 
  //    (since your node controller uses $push only).
  const saveAccessChanges = async () => {
    if (!selectedUser) return;

    try {
      const userId = getEntityId(selectedUser);
      if (!userId) {
        toast.error('User ID not found.');
        return;
      }

      const requests: Promise<unknown>[] = [];
      let attemptedRemoval = false;

      // Check if view access needs to be added
      if (viewAccess && !selectedUserHasViewAccess) {
        requests.push(axios.patch(`${import.meta.env.VITE_APP_API}/api/users/${userId}`, {
          department: PURCHASE_DEPARTMENT,
          access: 'view',
        }));
      } else if (!viewAccess && selectedUserHasViewAccess) {
        attemptedRemoval = true;
      }

      // Check if edit access needs to be added
      if (editAccess && !selectedUserHasEditAccess) {
        requests.push(axios.patch(`${import.meta.env.VITE_APP_API}/api/users/${userId}`, {
          department: PURCHASE_DEPARTMENT,
          access: 'edit',
        }));
      } else if (!editAccess && selectedUserHasEditAccess) {
        attemptedRemoval = true;
      }

      // If nothing to push, handle the UI notifications
      if (requests.length === 0) {
        if (attemptedRemoval) {
          toast.error('To remove access, the backend API requires a $pull logic update. Currently, it only adds access.');
        } else {
          toast.info('No new access to add.');
        }
        return;
      }

      // Fire off all patches concurrently
      await toast.promise(
        Promise.all(requests),
        {
          loading: 'Saving access changes...',
          success: 'Access updated successfully.',
          error: 'Failed to update access.',
        },
      );

      // Alert if they checked one but unchecked another
      if (attemptedRemoval) {
        toast.warning('New access was added, but removing access is currently not supported by the backend.');
      }

      await loadUsers();
      closeAccessCheckModal();
    } catch {
      // Error shown via toast.promise.
    }
  };
  // --- END HIGHLIGHT ---

  useEffect(() => {
    loadPurchases();
  }, []);

  const openEditModal = (item: PurchaseItem, field: string) => {
    setEditItem(item);
    setEditField(field);
    setEditValue(String(item[field] ?? ''));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditItem(null);
    setEditField('');
    setEditValue('');
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editItem) {
      return;
    }

    const itemId = editItem._id ?? editItem.id;
    if (!itemId) {
      setError('Unable to edit purchase item: missing ID.');
      return;
    }

    try {
      await toast.promise(
        (async () => {
          await axios.put(`${import.meta.env.VITE_APP_API}/api/purchases/${itemId}`, {
            [editField]: normalizeFieldValue(editField, editValue),
          });
          await loadPurchases();
          closeEditModal();
        })(),
        {
          loading: 'Saving changes...',
          success: 'Purchase updated.',
          error: 'Failed to update purchase.',
        },
      );
    } catch {
      setError('Failed to update purchase.');
    }
  };

  const RenderTable = () => {
    if (loading) {
      return <div className={styles.empty}>Loading...</div>;
    }
    if (purchases.length === 0) {
      return <div className={styles.empty}>No purchases found.</div>;
    }

    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {purchases.map((item) => {
              const itemId = item._id ?? item.id ?? '';
              return (
                <tr key={itemId || Math.random().toString()}>
                  {columns.map((column) => (
                    <td key={`${itemId}-${column}`}>
                      <div className={styles.cellValue}>{formatCellValue(column, item[column])}</div>
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.cellEdit}
                          onClick={() => openEditModal(item, column)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  ))}
                  {canEdit && <td></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main className={styles.purchase}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>Purchase Orders</h1>
            <p>Review and manage purchase entries.</p>
          </div>
          <div className={styles.actions}>
            {canEdit && (
              <button type="button" className={styles.createButton} onClick={openManageAccess}>
                Manage Access
              </button>
            )}
            <button type="button" className={styles.createButton} onClick={() => navigate('/purchase/new')}>
              Create
            </button>
            <button type="button" className={styles.backButton} onClick={() => navigate('/')}>Home</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <RenderTable/>
      </section>

      

      {showEditModal && editItem && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit {editField}</h2>
              <button type="button" className={styles.closeButton} onClick={closeEditModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className={styles.form}>
              <label className={styles.field}>
                <span>{fieldLabelMap[editField] ?? editField}</span>
                {editField === 'status' ? (
                  <select value={editValue} onChange={(event) => setEditValue(event.target.value)} required>
                    <option value="">Select status</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={fieldDefinitions.find((item) => item.name === editField)?.type ?? 'text'}
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    required
                  />
                )}
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccessModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Manage User Access</h2>
              <button type="button" className={styles.closeButton} onClick={() => setShowAccessModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.accessList}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={getEntityId(user) ?? user.email}>
                      <td>{user.name || '-'}</td>
                      <td>{user.email || '-'}</td>
                      <td>{user.role || '-'}</td>
                      <td>
                        {canEdit && (
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => openAccessModal(user)}
                          >
                            Access
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowAccessModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccessCheckModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Access for {selectedUser.name || selectedUser.email}</h2>
              <button type="button" className={styles.closeButton} onClick={closeAccessCheckModal}>
                ×
              </button>
            </div>
            <div className={styles.accessCheckboxes}>
              <p className={styles.accessNote}>
                Manage this user&apos;s access to the Purchase department.
              </p>
              <label className={styles.field}>
                <input
                  type="checkbox"
                  checked={viewAccess}
                  onChange={(e) => setViewAccess(e.target.checked)}
                />
                <span>View Access</span>
              </label>
              <label className={styles.field}>
                <input
                  type="checkbox"
                  checked={editAccess}
                  onChange={(e) => setEditAccess(e.target.checked)}
                />
                <span>Edit Access</span>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeAccessCheckModal}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={saveAccessChanges}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Purchase;