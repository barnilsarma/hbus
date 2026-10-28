import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaPlus, FaTimes } from 'react-icons/fa';
import styles from './Purchase.module.scss';

type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'datetime-local' | 'date' | 'select';
  required: boolean;
};

const fieldDefinitions: FieldDef[] = [
  { name: 'PONumber', label: 'PO Number', type: 'text', required: true },
  { name: 'supplier', label: 'Supplier', type: 'text', required: false },
  { name: 'supplierAddress', label: 'Supplier Address', type: 'text', required: false },
  { name: 'supplierState', label: 'Supplier State', type: 'text', required: false },
  { name: 'supplierStateCode', label: 'Supplier State Code', type: 'number', required: false },
  { name: 'gstn', label: 'GSTN', type: 'text', required: false },
  { name: 'date', label: 'Order Date', type: 'datetime-local', required: false },
  { name: 'status', label: 'Status', type: 'select', required: false },
  { name: 'invoicenumber', label: 'Invoice Number', type: 'text', required: false },
  { name: 'invoicedate', label: 'Invoice Date', type: 'datetime-local', required: false },
  { name: 'receiptdate', label: 'Receipt Date', type: 'datetime-local', required: false },
  { name: 'receivedqty', label: 'Received Quantity', type: 'number', required: false },
];

const visibleFields = fieldDefinitions.map((f) => f.name);
const statusOptions = ['INCOMPLETE', 'DELAYED', 'COMPLETE'] as const;

const normalizeFieldValue = (field: string, value: string) => {
  if (value === '') return undefined;
  const def = fieldDefinitions.find((d) => d.name === field);

  if (def?.type === 'number') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (def?.type === 'datetime-local' || def?.type === 'date') {
    const dateObj = new Date(value);
    return Number.isNaN(dateObj.getTime()) ? undefined : dateObj.toISOString();
  }

  return value;
};

const getCreatedPurchaseId = (data: unknown): string | null => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const id = envelope._id ?? envelope.id;
    if (typeof id === 'string') return id;
    const nested = envelope.data ?? envelope.purchase;
    if (nested === undefined || nested === result) break;
    result = nested;
  }
  return null;
};

export default function PurchaseNew({ primary = false }: { primary?: boolean }) {
  const navigate = useNavigate();
  const [createData, setCreateData] = useState<Record<string, string>>(
    Object.fromEntries(visibleFields.map((f) => [f, ''])) as Record<string, string>,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  const locationId = localStorage.getItem('hbus_selected_location_id');

  if (!locationId || locationId === 'ALL') {
    const locationError = 'Please select a specific location before creating a purchase order.';
    setError(locationError);
    toast.error(locationError);
    return;
  }

  const payload = {
    ...Object.fromEntries(
      Object.entries(createData)
        .filter(([key]) => !primary || key !== 'receivedqty')
        .map(([k, v]) => [k, normalizeFieldValue(k, v)])
        .filter(([, v]) => v !== undefined),
    ),
    locationId,
    location: locationId,
    ...(primary ? { rawMaterials: [] } : { items: [] }),
  };

  try {
    const endpoint = primary ? '/api/raw-material-pos' : '/api/purchases';
    const res = await axios.post(`${import.meta.env.VITE_APP_API}${endpoint}`, payload);
    toast.success('Purchase order created successfully.');
    if (primary) {
      const purchaseId = getCreatedPurchaseId(res.data);
      if (!purchaseId) {
        const message = 'Purchase order was created, but the response did not include its ID.';
        setError(message);
        toast.error(message);
        return;
      }
      navigate(`/purchase-primary/${purchaseId}`);
    } else {
      navigate('/purchase');
    }
  } catch (err: any) {
    const serverMsg = err.response?.data?.message || 'Failed to create purchase.';
    setError(serverMsg);
    toast.error(serverMsg);
  }
};
  return (
    <main className={styles.purchase}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>{primary ? 'Create Raw Material Purchase Order' : 'Create Purchase Order'}</h1>
            <p>Fill in the required information to generate a new purchase record.</p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate(primary ? '/purchase-primary' : '/purchase')}
            >
              <FaArrowLeft size={14} style={{ marginRight: '6px' }} />
              Back
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.formGrid}>
          {fieldDefinitions.map((field) => {
            if (primary && field.name === 'receivedqty') return null;
            return (
                <div key={field.name} className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    <span>{field.label}</span>
                    {field.required && <span className={styles.requiredMark}>*</span>}
                  </label>

                  {field.name === 'status' ? (
                    <div className={styles.inputWrapper}>
                      <select
                        value={createData[field.name] ?? ''}
                        onChange={(e) => setCreateData((p) => ({ ...p, [field.name]: e.target.value }))}
                        required={field.required}
                        className={styles.selectInput}
                      >
                        <option value="">Select status</option>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={styles.inputWrapper}>
                      <input
                        type={field.type}
                        value={createData[field.name] ?? ''}
                        onChange={(e) => setCreateData((p) => ({ ...p, [field.name]: e.target.value }))}
                        required={field.required}
                        placeholder={field.type === 'text' || field.type === 'number' ? `Enter ${field.label.toLowerCase()}` : undefined}
                        className={styles.textInput}
                      />
                    </div>
                  )}
                </div>
            );
          })}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate(primary ? '/purchase-primary' : '/purchase')}
            >
              <FaTimes size={14} style={{ marginRight: '6px' }} />
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton}>
              <FaPlus size={14} style={{ marginRight: '6px' }} />
              {primary ? 'Create Raw Material PO' : 'Create Purchase'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}