import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Purchase.module.scss';

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

const visibleFields = fieldDefinitions.map((f) => f.name);
const statusOptions = ['INCOMPLETE', 'DELAYED', 'COMPLETE'] as const;

const normalizeFieldValue = (field: string, value: string) => {
  if (value === '') return undefined;
  const def = fieldDefinitions.find((d) => d.name === field);
  if (def?.type === 'number') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return value;
};

export default function PurchaseNew() {
  const navigate = useNavigate();
  const [createData, setCreateData] = useState<Record<string, string>>(
    Object.fromEntries(visibleFields.map((f) => [f, ''])) as Record<string, string>,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(createData)
        .map(([k, v]) => [k, normalizeFieldValue(k, v)])
        .filter(([, v]) => v !== undefined),
    );

    try {
      await toast.promise(
        (async () => {
          await axios.post(`${import.meta.env.VITE_APP_API}/api/purchases`, payload);
        })(),
        {
          loading: 'Creating purchase...',
          success: 'Purchase created.',
          error: 'Failed to create purchase.',
        },
      );

      navigate('/purchase');
    } catch (err) {
      setError('Failed to create purchase.');
    }
  };

  return (
    <main className={styles.purchase}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>Create Purchase</h1>
            <p>Fill required fields and submit.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => navigate('/purchase')}>
              Back
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {fieldDefinitions.map((field) => (
            <label key={field.name} className={styles.field}>
              <span>{field.label}</span>
              {field.name === 'status' ? (
                <select
                  value={createData[field.name] ?? ''}
                  onChange={(e) => setCreateData((p) => ({ ...p, [field.name]: e.target.value }))}
                  required={field.required ?? false}
                >
                  <option value="">Select status</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={createData[field.name] ?? ''}
                  onChange={(e) => setCreateData((p) => ({ ...p, [field.name]: e.target.value }))}
                  required={field.required ?? false}
                />
              )}
            </label>
          ))}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/purchase')}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton}>
              Create
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
