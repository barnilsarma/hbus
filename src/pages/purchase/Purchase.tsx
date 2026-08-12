import axios from 'axios';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Purchase.module.scss';

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

const hiddenFields = ['_id', 'id', 'createdAt', 'updatedAt', '__v'];

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
  

  const role = localStorage.getItem('hbus_user_role');
  const canEdit = role === 'A' || role === 'B';

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

  useEffect(() => {
    loadPurchases();
  }, []);

  

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(createData)
        .map(([key, value]) => [key, normalizeFieldValue(key, value)])
        .filter(([, value]) => value !== undefined),
    );
    try {
      await toast.promise(
        (async () => {
          await axios.post(`${import.meta.env.VITE_APP_API}/api/purchases`, payload);
          await loadPurchases();
          closeCreateModal();
        })(),
        {
          loading: 'Creating purchase item...',
          success: 'Purchase created.',
          error: 'Failed to create purchase.',
        },
      );
    } catch {
      setError('Failed to create purchase.');
    }
  };

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

  const renderTable = () => {
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
            <button type="button" className={styles.createButton} onClick={() => navigate('/purchase/new')}>
              Create
            </button>
            <button type="button" className={styles.backButton} onClick={() => navigate('/')}>Home</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {renderTable()}
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
    </main>
  );
};

export default Purchase;
