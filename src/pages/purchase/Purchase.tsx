import axios from 'axios';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Purchase.module.scss';
import { FaPencilAlt, FaFilter, FaTimes } from 'react-icons/fa';

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

// --- Filter Type Definitions ---
export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after';

export interface ColumnFilter {
  operator: FilterOperator;
  value: string;
  valueTo?: string; // For range/between operations
}

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

  // --- Filtering State ---
  const [showFilterRow, setShowFilterRow] = useState(false);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});

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
  const isAdmin = role === 'A' || role === 'B';
  const [canEditItems, setCanEditItems] = useState<boolean>(isAdmin);

  useEffect(() => {
    if (!isAdmin) {
      try {
        const storedEditAccess = JSON.parse(localStorage.getItem('hbus_user_editaccess') || '[]');
        if (hasDepartmentAccess(storedEditAccess, PURCHASE_DEPARTMENT)) {
          setCanEditItems(true);
          return;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }

      const currentUserId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');
      if (currentUserId) {
        axios.get(`${import.meta.env.VITE_APP_API}/api/users/${currentUserId}`)
          .then((res) => {
            if (hasDepartmentAccess(res.data?.editaccess, PURCHASE_DEPARTMENT)) {
              setCanEditItems(true);
            }
          })
          .catch((err) => console.error('Failed to fetch logged in user access.', err));
      }
    }
  }, [isAdmin]);

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

  const saveAccessChanges = async () => {
    if (!selectedUser) return;

    try {
      const userId = getEntityId(selectedUser);
      if (!userId) {
        toast.error('User ID not found.');
        return;
      }

      const requests: Promise<unknown>[] = [];

      if (viewAccess && !selectedUserHasViewAccess) {
        requests.push(axios.patch(`${import.meta.env.VITE_APP_API}/api/users/${userId}`, {
          department: PURCHASE_DEPARTMENT,
          access: 'view',
        }));
      } else if (!viewAccess && selectedUserHasViewAccess) {
        requests.push(axios.delete(`${import.meta.env.VITE_APP_API}/api/users/revoke/${userId}`, {
          data: { department: PURCHASE_DEPARTMENT, access: 'view' },
        }));
      }

      if (editAccess && !selectedUserHasEditAccess) {
        requests.push(axios.patch(`${import.meta.env.VITE_APP_API}/api/users/${userId}`, {
          department: PURCHASE_DEPARTMENT,
          access: 'edit',
        }));
      } else if (!editAccess && selectedUserHasEditAccess) {
        requests.push(axios.delete(`${import.meta.env.VITE_APP_API}/api/users/revoke/${userId}`, {
          data: { department: PURCHASE_DEPARTMENT, access: 'edit' },
        }));
      }

      if (requests.length === 0) {
        toast.info('No access changes to save.');
        return;
      }

      await toast.promise(
        Promise.all(requests),
        {
          loading: 'Saving access changes...',
          success: 'Access updated successfully.',
          error: 'Failed to update access.',
        },
      );

      await loadUsers();
      closeAccessCheckModal();
    } catch {
      // Error is caught and shown by toast.promise
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  // --- Filter Logic ---
  const handleFilterChange = (field: string, key: keyof ColumnFilter, value: string) => {
    setFilters((prev) => {
      const currentFilter = prev[field] || { operator: 'contains', value: '' };
      const updatedFilter = { ...currentFilter, [key]: value };

      if (!updatedFilter.value && !updatedFilter.valueTo) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [field]: updatedFilter };
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      return Object.entries(filters).every(([field, filter]) => {
        if (!filter || (!filter.value && !filter.valueTo)) return true;

        const rawValue = item[field];
        const definition = fieldDefinitions.find((f) => f.name === field);
        const fieldType = definition?.type ?? 'text';

        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return false;
        }

        // 1. Number comparison
        if (fieldType === 'number') {
          const numVal = Number(rawValue);
          const valFrom = Number(filter.value);
          const valTo = Number(filter.valueTo);

          if (Number.isNaN(numVal)) return false;

          switch (filter.operator) {
            case 'equals':
              return numVal === valFrom;
            case 'notEquals':
              return numVal !== valFrom;
            case 'gt':
              return numVal > valFrom;
            case 'gte':
              return numVal >= valFrom;
            case 'lt':
              return numVal < valFrom;
            case 'lte':
              return numVal <= valFrom;
            case 'between':
              return (
                (!filter.value || numVal >= valFrom) &&
                (!filter.valueTo || numVal <= valTo)
              );
            default:
              return true;
          }
        }

        // 2. Date comparison
        if (fieldType === 'date') {
          const itemTime = new Date(rawValue).getTime();
          const filterTime = new Date(filter.value).getTime();
          const filterTimeTo = new Date(filter.valueTo || '').getTime();

          if (Number.isNaN(itemTime)) return false;

          const normalizeDay = (timestamp: number) => {
            const d = new Date(timestamp);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          };

          const itemDay = normalizeDay(itemTime);
          const filterDay = normalizeDay(filterTime);
          const filterDayTo = normalizeDay(filterTimeTo);

          switch (filter.operator) {
            case 'equals':
              return itemDay === filterDay;
            case 'notEquals':
              return itemDay !== filterDay;
            case 'before':
            case 'lt':
              return itemDay < filterDay;
            case 'after':
            case 'gt':
              return itemDay > filterDay;
            case 'between':
              return (
                (!filter.value || itemDay >= filterDay) &&
                (!filter.valueTo || itemDay <= filterDayTo)
              );
            default:
              return true;
          }
        }

        // 3. String / Dropdown comparison
        const strVal = String(rawValue).toLowerCase().trim();
        const targetStr = filter.value.toLowerCase().trim();

        switch (filter.operator) {
          case 'equals':
            return strVal === targetStr;
          case 'notEquals':
            return strVal !== targetStr;
          case 'startsWith':
            return strVal.startsWith(targetStr);
          case 'endsWith':
            return strVal.endsWith(targetStr);
          case 'contains':
          default:
            return strVal.includes(targetStr);
        }
      });
    });
  }, [purchases, filters]);

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

  const renderFilterControl = (field: string) => {
    const definition = fieldDefinitions.find((item) => item.name === field);
    const type = definition?.type ?? 'text';
    const currentFilter = filters[field] || {
      operator: type === 'number' ? 'equals' : type === 'date' ? 'equals' : 'contains',
      value: '',
      valueTo: '',
    };

    return (
      <div className={styles.filterControl}>
        <select
          className={styles.filterSelect}
          value={currentFilter.operator}
          onChange={(e) => handleFilterChange(field, 'operator', e.target.value as FilterOperator)}
        >
          {type === 'text' && (
            <>
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="notEquals">Not Equal</option>
              <option value="startsWith">Starts With</option>
              <option value="endsWith">Ends With</option>
            </>
          )}
          {type === 'number' && (
            <>
              <option value="equals">=</option>
              <option value="notEquals">≠</option>
              <option value="gt">&gt;</option>
              <option value="gte">&ge;</option>
              <option value="lt">&lt;</option>
              <option value="lte">&le;</option>
              <option value="between">Range</option>
            </>
          )}
          {type === 'date' && (
            <>
              <option value="equals">On</option>
              <option value="before">Before</option>
              <option value="after">After</option>
              <option value="between">Between</option>
            </>
          )}
          {type === 'select' && (
            <>
              <option value="equals">Equals</option>
              <option value="notEquals">Not Equal</option>
            </>
          )}
        </select>

        {type === 'select' ? (
          <select
            className={styles.filterInput}
            value={currentFilter.value}
            onChange={(e) => handleFilterChange(field, 'value', e.target.value)}
          >
            <option value="">All</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <div className={styles.filterInputsGroup}>
            <input
              type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
              className={styles.filterInput}
              placeholder={currentFilter.operator === 'between' ? 'Min / From' : 'Search...'}
              value={currentFilter.value}
              onChange={(e) => handleFilterChange(field, 'value', e.target.value)}
            />
            {currentFilter.operator === 'between' && (
              <input
                type={type === 'number' ? 'number' : 'date'}
                className={styles.filterInput}
                placeholder={type === 'number' ? 'Max' : 'To'}
                value={currentFilter.valueTo ?? ''}
                onChange={(e) => handleFilterChange(field, 'valueTo', e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    );
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
                <th key={column}>{fieldLabelMap[column] ?? column}</th>
              ))}
              {canEditItems && <th>Actions</th>}
            </tr>
            {showFilterRow && (
              <tr className={styles.filterRow}>
                {columns.map((column) => (
                  <th key={`filter-${column}`}>{renderFilterControl(column)}</th>
                ))}
                {canEditItems && <th></th>}
              </tr>
            )}
          </thead>
          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canEditItems ? 1 : 0)} className={styles.empty}>
                  No matching items found.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((item) => {
                const itemId = item._id ?? item.id ?? '';
                return (
                  <tr key={itemId || Math.random().toString()}>
                    {columns.map((column) => (
                      <td key={`${itemId}-${column}`} className={styles.cell}>
                        <div className={styles.cellValue}>{formatCellValue(column, item[column])}</div>
                        {canEditItems && (
                          <button
                            type="button"
                            className={styles.cellEdit}
                            onClick={() => openEditModal(item, column)}
                          >
                            <FaPencilAlt size={16} color="#ffffff" className={styles.cellEditIcon} />
                          </button>
                        )}
                      </td>
                    ))}
                    {canEditItems && <td></td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <main className={styles.purchase}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>Purchase Orders</h1>
            <p>Review and manage purchase entries.</p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={showFilterRow ? styles.activeFilterButton : styles.secondaryButton}
              onClick={() => setShowFilterRow((prev) => !prev)}
            >
              <FaFilter size={14} style={{ marginRight: '6px' }} />
              {showFilterRow ? 'Hide Filters' : 'Filter Columns'}
            </button>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFilterButton} onClick={clearFilters}>
                <FaTimes size={14} style={{ marginRight: '6px' }} />
                Clear Filters
              </button>
            )}

            {isAdmin && (
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

        <RenderTable />
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
                        {isAdmin && (
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
                  onChange={(e) => {
                    setViewAccess(e.target.checked);
                    if (!e.target.checked) setEditAccess(false);
                  }}
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