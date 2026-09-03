import axios from 'axios';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Purchase.module.scss';
import { FaPencilAlt, FaFilter, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';

type User = {
  userId?: string;
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  viewaccess?: string[];
  editaccess?: string[];
  location?: any;
  locations?: any[];
};

const getEntityId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entity = value as { userId?: unknown; _id?: unknown; id?: unknown };
    return (
      (typeof entity.userId === 'string' && entity.userId) ||
      (typeof entity._id === 'string' && entity._id) ||
      (typeof entity.id === 'string' && entity.id) ||
      null
    );
  }
  return null;
};

const hasDepartmentAccess = (access: string[] | undefined, department: string) =>
  (access ?? []).some((departmentName) => departmentName.trim().toLowerCase() === department.trim().toLowerCase());

const PURCHASE_DEPARTMENT = 'Purchase';

type PurchaseItem = {
  _id?: string;
  id?: string;
  PONumber: string;
  supplier?: string;
  supplierAddress?: string;
  supplierState?: string;
  supplierStateCode?: number;
  gstn?: string;
  date?: string;
  status?: 'INCOMPLETE' | 'DELAYED' | 'COMPLETE';
  invoicenumber?: string;
  invoicedate?: string;
  receiptdate?: string;
  receivedqty?: number;
  location?: any;
  items?: any[]; // References the IItem array
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

const visibleFields = [
  'PONumber',
  'supplier',
  'supplierAddress',
  'supplierState',
  'supplierStateCode',
  'gstn',
  'date',
  'status',
  'invoicenumber',
  'invoicedate',
  'receiptdate',
  'receivedqty',
];

const statusOptions = ['INCOMPLETE', 'DELAYED', 'COMPLETE'] as const;

const fieldDefinitions = [
  { name: 'PONumber', label: 'PO Number', type: 'text', required: true },
  { name: 'supplier', label: 'Supplier', type: 'text' },
  { name: 'supplierAddress', label: 'Supplier Address', type: 'text' },
  { name: 'supplierState', label: 'Supplier State', type: 'text' },
  { name: 'supplierStateCode', label: 'Supplier State Code', type: 'number' },
  { name: 'gstn', label: 'GSTN', type: 'text' },
  { name: 'date', label: 'Order Date', type: 'date' },
  { name: 'status', label: 'Status', type: 'select' },
  { name: 'invoicenumber', label: 'Invoice Number', type: 'text' },
  { name: 'invoicedate', label: 'Invoice Date', type: 'date' },
  { name: 'receiptdate', label: 'Receipt Date', type: 'date' },
  { name: 'receivedqty', label: 'Received Quantity', type: 'number' },
] as const;

const fieldLabelMap = Object.fromEntries(fieldDefinitions.map((field) => [field.name, field.label]));

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
  valueTo?: string;
}

const formatCellValue = (field: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return '-';

  if (field === 'location') {
    if (typeof value === 'object' && value !== null) {
      return (value as any).name || (value as any)._id || '-';
    }
    return String(value);
  }

  const definition = fieldDefinitions.find((f) => f.name === field);
  if (definition?.type === 'date' && typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  return String(value);
};

const normalizeFieldValue = (field: string, value: string) => {
  if (value === '') return undefined;

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

  // --- Location State ---
  const [userLocation, setUserLocation] = useState<string | string[] | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return localStorage.getItem('hbus_selected_location_id') || 'ALL';
  });
  const [availableLocations, setAvailableLocations] = useState<any[]>([]);

  // --- Modal States ---
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
  const isTypeA = role === 'A';
  const isAdmin = isTypeA || role === 'B';
  const [canEditItems, setCanEditItems] = useState<boolean>(isAdmin);

  // Fetch current logged-in user context
  useEffect(() => {
    const currentUserId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');

    if (currentUserId) {
      axios
        .get(`${import.meta.env.VITE_APP_API}/api/users/${currentUserId}`)
        .then((res) => {
          const userData = res.data;
          const loc = userData?.location;

          if (!isTypeA && loc) {
            const locId = typeof loc === 'object' ? loc._id : loc;
            setUserLocation(locId);
          }

          if (!isAdmin && hasDepartmentAccess(userData?.editaccess, PURCHASE_DEPARTMENT)) {
            setCanEditItems(true);
          }
        })
        .catch((err) => console.error('Failed to fetch user context.', err));
    }
  }, [isAdmin, isTypeA]);

  // Read edit permission fallback from local storage
  useEffect(() => {
    if (!isAdmin) {
      try {
        const storedEditAccess = JSON.parse(localStorage.getItem('hbus_user_editaccess') || '[]');
        if (hasDepartmentAccess(storedEditAccess, PURCHASE_DEPARTMENT)) {
          setCanEditItems(true);
        }
      } catch (e) {
        // Ignore JSON parse error
      }
    }
  }, [isAdmin]);

  const columns = visibleFields;

  const loadLocations = async () => {
    try {
      const baseUrl = import.meta.env.VITE_APP_API;
      const response = await axios.get(`${baseUrl}/api/location`);
      const rawData = response.data.data || response.data;
      setAvailableLocations(Array.isArray(rawData) ? rawData : []);
    } catch (err) {
      console.error('Failed to load available locations.', err);
    }
  };

  const loadPurchases = async () => {
    setLoading(true);
    try {
      await toast.promise(
        (async () => {
          const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/purchases`);
          const data: PurchaseItem[] = Array.isArray(response.data) ? response.data : [];
          setPurchases(data);
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

  useEffect(() => {
    loadPurchases();
    loadLocations();
  }, []);

  const handleLocationChange = (newLocId: string) => {
    setSelectedLocationId(newLocId);
    if (newLocId === 'ALL') {
      localStorage.removeItem('hbus_selected_location_id');
    } else {
      localStorage.setItem('hbus_selected_location_id', newLocId);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      toast.error('Failed to load user list.');
    }
  };

  const openManageAccess = async () => {
    await loadUsers();
    setShowAccessModal(true);
  };

  const openAccessModal = (user: User) => {
    setSelectedUser(user);
    setViewAccess(hasDepartmentAccess(user.viewaccess, PURCHASE_DEPARTMENT));
    setEditAccess(hasDepartmentAccess(user.editaccess, PURCHASE_DEPARTMENT));
    setShowAccessCheckModal(true);
  };

  const closeAccessCheckModal = () => {
    setSelectedUser(null);
    setShowAccessCheckModal(false);
  };

  const saveAccessChanges = async () => {
    if (!selectedUser) return;
    const userId = getEntityId(selectedUser);
    if (!userId) {
      toast.error('Invalid user selected.');
      return;
    }

    try {
      const currentView = selectedUser.viewaccess || [];
      const currentEdit = selectedUser.editaccess || [];

      const updatedView = viewAccess
        ? Array.from(new Set([...currentView, PURCHASE_DEPARTMENT]))
        : currentView.filter((d) => d.trim().toLowerCase() !== PURCHASE_DEPARTMENT.toLowerCase());

      const updatedEdit = editAccess
        ? Array.from(new Set([...currentEdit, PURCHASE_DEPARTMENT]))
        : currentEdit.filter((d) => d.trim().toLowerCase() !== PURCHASE_DEPARTMENT.toLowerCase());

      await axios.put(`${import.meta.env.VITE_APP_API}/api/users/${userId}/access`, {
        viewaccess: updatedView,
        editaccess: updatedEdit,
      });

      toast.success('User access permissions updated.');
      closeAccessCheckModal();
      loadUsers();
    } catch (err) {
      toast.error('Failed to update access settings.');
    }
  };

  const openEditModal = (item: PurchaseItem, field: string) => {
    if (!canEditItems) return;
    setEditItem(item);
    setEditField(field);

    let initialVal = item[field] !== undefined && item[field] !== null ? String(item[field]) : '';
    const definition = fieldDefinitions.find((f) => f.name === field);
    if (definition?.type === 'date' && initialVal) {
      const parsedDate = new Date(initialVal);
      if (!Number.isNaN(parsedDate.getTime())) {
        initialVal = parsedDate.toISOString().split('T')[0];
      }
    }

    setEditValue(initialVal);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditItem(null);
    setEditField('');
    setEditValue('');
    setShowEditModal(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !editField) return;

    const itemId = getEntityId(editItem);
    if (!itemId) {
      toast.error('Item identifier not found.');
      return;
    }

    const payloadValue = normalizeFieldValue(editField, editValue);

    try {
      await toast.promise(
        axios.put(`${import.meta.env.VITE_APP_API}/api/purchases/${itemId}`, {
          [editField]: payloadValue,
        }),
        {
          loading: 'Updating record...',
          success: 'Record updated successfully.',
          error: 'Failed to update record.',
        },
      );

      setPurchases((prev) =>
        prev.map((item) => (getEntityId(item) === itemId ? { ...item, [editField]: payloadValue } : item)),
      );
      closeEditModal();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilterChange = (field: string, key: keyof ColumnFilter, value: string) => {
    setFilters((prev) => {
      const currentFilter: ColumnFilter = prev[field] || {
        operator: 'contains',
        value: '',
      };

      const updatedFilter: ColumnFilter = {
        ...currentFilter,
        [key]: value,
      };

      if (key !== 'operator' && !updatedFilter.value && !updatedFilter.valueTo) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [field]: updatedFilter,
      };
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      // 1. Role / Location Filter Rules
      const itemLocRaw = item.location;
      const itemLocId = typeof itemLocRaw === 'object' && itemLocRaw !== null ? getEntityId(itemLocRaw) : String(itemLocRaw || '');

      if (isTypeA) {
        if (selectedLocationId !== 'ALL') {
          if (itemLocId !== selectedLocationId) {
            return false;
          }
        }
      } else if (userLocation) {
        if (typeof userLocation === 'string') {
          if (itemLocId !== userLocation) {
            return false;
          }
        } else if (Array.isArray(userLocation)) {
          if (!userLocation.includes(itemLocId!)) {
            return false;
          }
        }
      }

      // 2. Dynamic Table Column Filters
      return Object.entries(filters).every(([field, filter]) => {
        if (!filter || (!filter.value && !filter.valueTo)) return true;

        const rawValue = item[field];
        const definition = fieldDefinitions.find((f) => f.name === field);
        const fieldType = definition?.type ?? 'text';

        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return false;
        }

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
              return (!filter.value || numVal >= valFrom) && (!filter.valueTo || numVal <= valTo);
            default:
              return true;
          }
        }

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
              return (!filter.value || itemDay >= filterDay) && (!filter.valueTo || itemDay <= filterDayTo);
            default:
              return true;
          }
        }

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
  }, [purchases, filters, isTypeA, selectedLocationId, userLocation]);

  const renderFilterControl = (field: string) => {
    const definition = fieldDefinitions.find((f) => f.name === field);
    const fieldType = definition?.type ?? 'text';
    const filter = filters[field] || { operator: 'contains', value: '' };

    if (fieldType === 'number') {
      return (
        <div className={styles.filterControlGroup}>
          <select
            className={styles.filterSelect}
            value={filter.operator}
            onChange={(e) => handleFilterChange(field, 'operator', e.target.value as FilterOperator)}
          >
            <option value="equals">=</option>
            <option value="notEquals">!=</option>
            <option value="gt">&gt;</option>
            <option value="gte">&gt;=</option>
            <option value="lt">&lt;</option>
            <option value="lte">&lt;=</option>
            <option value="between">Between</option>
          </select>
          <input
            type="number"
            className={styles.filterInput}
            placeholder="Val"
            value={filter.value || ''}
            onChange={(e) => handleFilterChange(field, 'value', e.target.value)}
          />
          {filter.operator === 'between' && (
            <input
              type="number"
              className={styles.filterInput}
              placeholder="To"
              value={filter.valueTo || ''}
              onChange={(e) => handleFilterChange(field, 'valueTo', e.target.value)}
            />
          )}
        </div>
      );
    }

    if (fieldType === 'date') {
      return (
        <div className={styles.filterControlGroup}>
          <select
            className={styles.filterSelect}
            value={filter.operator}
            onChange={(e) => handleFilterChange(field, 'operator', e.target.value as FilterOperator)}
          >
            <option value="equals">On</option>
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="between">Between</option>
          </select>
          <input
            type="date"
            className={styles.filterInput}
            value={filter.value || ''}
            onChange={(e) => handleFilterChange(field, 'value', e.target.value)}
          />
          {filter.operator === 'between' && (
            <input
              type="date"
              className={styles.filterInput}
              value={filter.valueTo || ''}
              onChange={(e) => handleFilterChange(field, 'valueTo', e.target.value)}
            />
          )}
        </div>
      );
    }

    return (
      <div className={styles.filterControlGroup}>
        <select
          className={styles.filterSelect}
          value={filter.operator}
          onChange={(e) => handleFilterChange(field, 'operator', e.target.value as FilterOperator)}
        >
          <option value="contains">Contains</option>
          <option value="equals">Equals</option>
          <option value="startsWith">Starts With</option>
          <option value="endsWith">Ends With</option>
        </select>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search..."
          value={filter.value || ''}
          onChange={(e) => handleFilterChange(field, 'value', e.target.value)}
        />
      </div>
    );
  };

  const RenderTable = () => (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{fieldLabelMap[col] || col}</th>
            ))}
          </tr>
          {showFilterRow && (
            <tr className={styles.filterRow}>
              {columns.map((col) => (
                <th key={`filter-${col}`}>{renderFilterControl(col)}</th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className={styles.noData}>
                Loading purchases...
              </td>
            </tr>
          ) : filteredPurchases.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.noData}>
                No purchase items match the criteria.
              </td>
            </tr>
          ) : (
            filteredPurchases.map((item, index) => (
              <tr key={getEntityId(item) || index}>
                {columns.map((col) => (
                  <td key={col}>
                    <div className={styles.cellContent}>
                      <span>{formatCellValue(col, item[col])}</span>
                      {canEditItems && (
                        <button
                          type="button"
                          className={styles.inlineEditButton}
                          onClick={() => openEditModal(item, col)}
                          title={`Edit ${fieldLabelMap[col] || col}`}
                        >
                          <FaPencilAlt size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                ))}
                <td>
                  <Link to={`/PO/${getEntityId(item)}`} className="text-[#110055] bg-[#ffffff]">
                    GENERATE PO
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

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
            {isTypeA && (
              <div className={styles.locationSelector}>
                <FaMapMarkerAlt size={14} style={{ marginRight: '6px' }} />
                <select
                  className={styles.selectInput}
                  value={selectedLocationId}
                  onChange={(e) => handleLocationChange(e.target.value)}
                >
                  <option value="ALL">All Locations</option>
                  {availableLocations.map((loc, idx) => {
                    const locId = loc._id || loc.id;
                    const locName = typeof loc === 'object' ? loc.name || '' : String(loc);

                    if (!locId || !locName) return null;

                    return (
                      <option key={locId || idx} value={locId}>
                        <span className="bg-[#000000] text-white px-2 py-1 rounded">
                          {locName}
                        </span>
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

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
            <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
              Home
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <RenderTable />
      </section>

      {/* Edit Field Modal */}
      {showEditModal && editItem && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Edit {fieldLabelMap[editField] || editField}</h2>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.formGroup}>
                <label>{fieldLabelMap[editField] || editField}</label>
                {editField === 'status' ? (
                  <select
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="">Select status</option>
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={fieldDefinitions.find((f) => f.name === editField)?.type || 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={styles.textInput}
                  />
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.createButton}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Access User List Modal */}
      {showAccessModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Manage User Access</h2>
            <p className={styles.modalSub}>Select a user to modify department access permissions.</p>
            <div className={styles.userList}>
              {users.map((u) => (
                <div key={getEntityId(u) || u.email} className={styles.userItem}>
                  <div>
                    <strong>{u.name || u.email}</strong>
                    <span className={styles.userEmail}>{u.email}</span>
                  </div>
                  <button type="button" className={styles.secondaryButton} onClick={() => openAccessModal(u)}>
                    Edit Access
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowAccessModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Access Level Modal */}
      {showAccessCheckModal && selectedUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Manage Access: {selectedUser.name || selectedUser.email}</h2>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={viewAccess}
                  onChange={(e) => setViewAccess(e.target.checked)}
                />
                View Access (Purchase Department)
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editAccess}
                  onChange={(e) => setEditAccess(e.target.checked)}
                />
                Edit Access (Purchase Department)
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeAccessCheckModal}>
                Cancel
              </button>
              <button type="button" className={styles.createButton} onClick={saveAccessChanges}>
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Purchase;