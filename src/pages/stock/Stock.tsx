import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaPencilAlt, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import DepartmentAccessManager from '../../components/DepartmentAccessManager';
import styles from './Stock.module.scss';

type Field = {
  key: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select';
  required?: boolean;
  options?: string[];
};

type Model = {
  label: string;
  resource: string;
  fields: Field[];
  displayFields?: string[];
  qtyPatch?: boolean;
};

type StockRecord = Record<string, unknown> & {
  _id?: string;
  id?: string;
};

const models: Model[] = [
  {
    label: 'Live Stock',
    resource: 'livestocks',
    fields: [
      { key: 'kva', required: true }, { key: 'codeCore' }, { key: 'codeLV' }, { key: 'codeHV' }, { key: 'location' },
    ],
    displayFields: [
      'kva', 'codeCore', 'codeLV', 'codeHV', 'looseCoreOrderedKG', 'lvConductorOrderedKG',
      'hvConductorOrderedKG', 'looseCoreStockKG', 'lvConductorStockKG', 'hvConductorStockKG',
      'readyToDispatch', 'rtdRepairing', 'defective', 'dispatch', 'location',
    ],
  },
  {
    label: 'Order Entry',
    resource: 'order-entries',
    fields: [
      { key: 'material', type: 'select', required: true, options: ['CORE', 'LV CONDUCTOR', 'HV CONDUCTOR'] },
      { key: 'kva', required: true }, { key: 'code', required: true }, { key: 'description' },
      { key: 'qty', type: 'number' }, { key: 'qtyinjob', type: 'number' }, { key: 'location' },
    ],
    qtyPatch: true,
  },
  {
    label: 'Invoice',
    resource: 'invoices',
    fields: [
      { key: 'receiptdate', type: 'date' }, { key: 'invoiceno' }, { key: 'invoicedate', type: 'date' },
      { key: 'purchaseno' }, { key: 'mcode' }, { key: 'supplier' }, { key: 'description' },
      { key: 'qty', type: 'number' }, { key: 'unit' }, { key: 'invoicerate', type: 'number' },
      { key: 'billamount', type: 'number' }, { key: 'remarks' },
    ],
    displayFields: [
      'sl', 'receiptdate', 'invoiceno', 'invoicedate', 'purchaseno', 'mcode', 'supplier',
      'description', 'qty', 'unit', 'invoicerate', 'totalamount', 'billamount', 'POqty',
      'POrate', 'received', 'remaining', 'remarks',
    ],
  },
  {
    label: 'Invoice PO',
    resource: 'invoice-pos',
    fields: [
      { key: 'date', type: 'date' }, { key: 'POnumber' }, { key: 'supplier' }, { key: 'icode' },
      { key: 'description' }, { key: 'qty', type: 'number' }, { key: 'unit' }, { key: 'rate', type: 'number' },
      { key: 'remarks' },
    ],
    displayFields: [
      'date', 'POnumber', 'supplier', 'icode', 'description', 'qty', 'unit', 'rate',
      'total', 'totalamountPO', 'received', 'remaining', 'remarks',
    ],
  },
  {
    label: 'Rejection Stock',
    resource: 'rejection-stocks',
    fields: [{ key: 'kva', required: true }],
    displayFields: ['kva', 'core', 'lvConductor', 'hvConductor', 'oil'],
  },
  {
    label: 'Rejection Entry',
    resource: 'rejection-entries',
    fields: [
      { key: 'timestamp', type: 'datetime-local' }, { key: 'email' }, { key: 'kva' },
      { key: 'coreRejectionKG', type: 'number' }, { key: 'lvConductorRejectionKG', type: 'number' },
      { key: 'hvConductorRejectionKG', type: 'number' }, { key: 'remarks_enter_purchase_no' },
      { key: 'oilRejectionLtr', type: 'number' }, { key: 'remarks' },
    ],
  },
  {
    label: 'Daily Production Report Stock',
    resource: 'daily-prod-report-stocks',
    fields: [{ key: 'kva', required: true }],
    displayFields: [
      'kva', 'tankPaintDone', 'coreAssembly', 'lvCoil', 'hvCoil', 'coilAssembly', 'boxup',
      'testingDone', 'tankOnlyFabrication',
    ],
  },
  {
    label: 'Daily Production',
    resource: 'daily-prods',
    fields: [
      { key: 'timestamp', type: 'datetime-local' }, { key: 'operator' }, { key: 'kva' },
      { key: 'tank', type: 'number' }, { key: 'coreAssemblyDone', type: 'number' },
      { key: 'lvCoilWinding', type: 'number' }, { key: 'hvCoilWinding', type: 'number' },
      { key: 'coilAssembly', type: 'number' }, { key: 'boxupDone', type: 'number' },
      { key: 'testingDone', type: 'number' }, { key: 'email' }, { key: 'remarks' },
      { key: 'date', type: 'date' }, { key: 'paint', type: 'number' }, { key: 'coreJobNo' },
      { key: 'lvJobNo' }, { key: 'hvJobNo' }, { key: 'coilJobNo' }, { key: 'boxupJobNo' },
    ],
  },
  {
    label: 'Per Job Data',
    resource: 'per-job-data',
    fields: [
      { key: 'kva' }, { key: 'coreCode' }, { key: 'lvConductorCode' }, { key: 'hvConductorCode' },
      { key: 'corePerJobKG', type: 'number' }, { key: 'lvConductorPerJobKG', type: 'number' },
      { key: 'hvConductorPerJobKG', type: 'number' }, { key: 'oilConsumptionPerJob', type: 'number' },
      { key: 'radiatorCode' }, { key: 'radiatorPerJob', type: 'number' }, { key: 'lvConductorSize' },
      { key: 'hvConductorSize' }, { key: 'widthWithRadiator', type: 'number' }, { key: 'length', type: 'number' },
      { key: 'height', type: 'number' }, { key: 'weightKG', type: 'number' },
      { key: 'blankTankWeight', type: 'number' }, { key: 'yellow' }, { key: 'manualIdea' },
    ],
  },
  {
    label: 'Stock Adjustment Entry',
    resource: 'stock-adjustment-entries',
    fields: [
      { key: 'email' }, { key: 'kva' }, { key: 'core', type: 'number' },
      { key: 'ltConductor', type: 'number' }, { key: 'htConductor', type: 'number' }, { key: 'remarks' },
    ],
  },
  {
    label: 'Production Floor',
    resource: 'production-flor',
    fields: [{ key: 'kva', required: true }],
    displayFields: [
      'kva', 'tank', 'coreAssemblyStock', 'lvCoilStock', 'hvCoilStock', 'coilAssembly',
      'boxup', 'rtd', 'tankOnlyFabrication',
    ],
  },
  {
    label: 'Repairing Data',
    resource: 'repairing-data',
    fields: [
      { key: 'timestamp', type: 'datetime-local' }, { key: 'email' }, { key: 'kva' },
      { key: 'totalRepairing', type: 'number' }, { key: 'workDetailsWithDTRSNo' }, { key: 'operator' },
      { key: 'lvCoilChanged', type: 'number' }, { key: 'hvCoilChanged', type: 'number' },
      { key: 'newOilUsing', type: 'number' }, { key: 'remarks' },
    ],
  },
  {
    label: 'Repairing Data Return Stock',
    resource: 'repairing-data-return-stocks',
    fields: [{ key: 'kva' }, { key: 'stock', type: 'number' }],
  },
  {
    label: 'Repairing Data Repairing Stock',
    resource: 'repairing-data-repairing-stocks',
    fields: [
      { key: 'kva' }, { key: 'stock', type: 'number' }, { key: 'lvCoil', type: 'number' },
      { key: 'hvCoil', type: 'number' }, { key: 'oil', type: 'number' },
    ],
  },
];

const getId = (record: StockRecord) => record._id || record.id || '';

const unwrapList = (value: unknown): StockRecord[] => {
  let data = value;
  while (data && typeof data === 'object' && !Array.isArray(data)) {
    const response = data as Record<string, unknown>;
    const nested = response.data ?? response.records ?? response.items;
    if (nested === undefined || nested === data) break;
    data = nested;
  }
  if (!Array.isArray(data)) throw new Error('Stock response was not a list.');
  return data as StockRecord[];
};

const fetchStockRecords = async (endpoint: string) => {
  const response = await axios.get(endpoint);
  return unwrapList(response.data);
};

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const hasStoredStockAccess = (key: string) => {
  try {
    const access: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(access) && access.some(
      (entry) => typeof entry === 'string' && entry.trim().toLowerCase() === 'stock',
    );
  } catch {
    return false;
  }
};

const displayValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toInputValue = (field: Field, value: unknown) => {
  if (value === undefined || value === null) return '';
  if (field.type === 'datetime-local' && typeof value === 'string') return value.slice(0, 16);
  if (field.type === 'date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
};

const Stock = () => {
  const { resource } = useParams<{ resource?: string }>();
  const navigate = useNavigate();
  const model = models.find((entry) => entry.resource === resource) ?? models[0];
  const isAdmin = ['A', 'B'].includes(localStorage.getItem('hbus_user_role') || '');
  const [canView, setCanView] = useState(
    () => isAdmin || hasStoredStockAccess('hbus_user_viewaccess') || hasStoredStockAccess('hbus_user_editaccess'),
  );
  const [canEdit, setCanEdit] = useState(() => isAdmin || hasStoredStockAccess('hbus_user_editaccess'));
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [qtyRecord, setQtyRecord] = useState<StockRecord | null>(null);
  const [newQty, setNewQty] = useState('');

  const fieldsToDisplay = useMemo(
    () => model.displayFields ?? model.fields.map((field) => field.key),
    [model],
  );
  const endpoint = `${import.meta.env.VITE_APP_API}/api/stock/${model.resource}`;

  useEffect(() => {
    if (isAdmin) return;

    let active = true;
    const includesStock = (access: unknown) =>
      Array.isArray(access) && access.some(
        (entry) => typeof entry === 'string' && entry.trim().toLowerCase() === 'stock',
      );
    const userId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');
    if (userId) {
      axios.get(`${import.meta.env.VITE_APP_API}/api/users/${encodeURIComponent(userId)}`)
        .then((response) => {
          if (!active) return;
          const viewAccess: unknown = response.data?.viewaccess ?? [];
          const editAccess: unknown = response.data?.editaccess ?? [];
          setCanEdit(includesStock(editAccess));
          setCanView(includesStock(viewAccess) || includesStock(editAccess));
          localStorage.setItem('hbus_user_viewaccess', JSON.stringify(viewAccess));
          localStorage.setItem('hbus_user_editaccess', JSON.stringify(editAccess));
        })
        .catch((requestError) => {
          console.error('Failed to load Stock access permissions.', requestError);
        });
    }

    return () => { active = false; };
  }, [isAdmin]);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await fetchStockRecords(endpoint));
      setError('');
    } catch (requestError) {
      console.error(`Failed to load ${model.label} records.`, requestError);
      const message = getErrorMessage(requestError, `Failed to load ${model.label.toLowerCase()} records.`);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, model.label]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    fetchStockRecords(endpoint)
      .then((result) => {
        if (!active) return;
        setRecords(result);
        setError('');
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        console.error(`Failed to load ${model.label} records.`, requestError);
        const message = getErrorMessage(requestError, `Failed to load ${model.label.toLowerCase()} records.`);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canView, endpoint, model.label]);

  useEffect(() => {
    if (resource && !models.some((entry) => entry.resource === resource)) {
      navigate(`/stock/${models[0].resource}`, { replace: true });
    } else if (!resource) {
      navigate(`/stock/${models[0].resource}`, { replace: true });
    }
  }, [navigate, resource]);

  const openNewForm = () => {
    setEditingId('');
    setForm(Object.fromEntries(model.fields.map((field) => [field.key, ''])));
    setModalOpen(true);
  };

  const openEditForm = async (record: StockRecord) => {
    const id = getId(record);
    if (!id) {
      toast.error('This record does not have an ID and cannot be edited.');
      return;
    }
    try {
      const response = await axios.get(`${endpoint}/${encodeURIComponent(id)}`);
      const detail = response.data?.data ?? response.data?.record ?? response.data;
      const values = Object.fromEntries(model.fields.map((field) => [
        field.key,
        toInputValue(field, detail?.[field.key] ?? record[field.key]),
      ]));
      setEditingId(id);
      setForm(values);
      setModalOpen(true);
    } catch (requestError) {
      console.error(`Failed to load ${model.label.toLowerCase()} record for editing.`, requestError);
      toast.error(getErrorMessage(requestError, 'Failed to load record details.'));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of model.fields) {
      const value = form[field.key] ?? '';
      if (value === '') {
        payload[field.key] = undefined;
      } else if (field.type === 'number') {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          toast.error(`Enter a valid number for ${field.key}.`);
          return;
        }
        payload[field.key] = number;
      } else {
        payload[field.key] = value;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${endpoint}/${encodeURIComponent(editingId)}`, payload);
        toast.success(`${model.label} updated.`);
      } else {
        await axios.post(endpoint, payload);
        toast.success(`${model.label} created.`);
      }
      setModalOpen(false);
      await loadRecords();
    } catch (requestError) {
      console.error(`Failed to ${editingId ? 'update' : 'create'} ${model.label.toLowerCase()}.`, requestError);
      toast.error(getErrorMessage(requestError, `Failed to ${editingId ? 'update' : 'create'} record.`));
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: StockRecord) => {
    const id = getId(record);
    if (!id) {
      toast.error('This record does not have an ID and cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete this ${model.label.toLowerCase()} record? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await axios.delete(`${endpoint}/${encodeURIComponent(id)}`);
      setRecords((current) => current.filter((entry) => getId(entry) !== id));
      toast.success(`${model.label} deleted.`);
    } catch (requestError) {
      console.error(`Failed to delete ${model.label.toLowerCase()}.`, requestError);
      toast.error(getErrorMessage(requestError, 'Failed to delete record.'));
    } finally {
      setDeletingId('');
    }
  };

  const submitQuantity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = qtyRecord && getId(qtyRecord);
    const quantity = Number(newQty);
    if (!id || !Number.isFinite(quantity) || quantity < 0) {
      toast.error('Enter a valid non-negative quantity.');
      return;
    }

    setSaving(true);
    try {
      await axios.patch(`${endpoint}/${encodeURIComponent(id)}/qty`, { new_qty: quantity });
      toast.success('Quantity updated.');
      setQtyRecord(null);
      await loadRecords();
    } catch (requestError) {
      console.error('Failed to update order entry quantity.', requestError);
      toast.error(getErrorMessage(requestError, 'Failed to update quantity.'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <Link className={styles.backLink} to="/"> <FaArrowLeft aria-hidden="true" /> Home</Link>
          <h1>Stock access required</h1>
          <p className={styles.subtitle}>You need Stock view access to open this section.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} to="/"><FaArrowLeft aria-hidden="true" /> Home</Link>
            <p className={styles.eyebrow}>STOCK MANAGEMENT</p>
            <h1>{model.label}</h1>
            <p className={styles.subtitle}>Browse and manage stock records.</p>
          </div>
          <div className={styles.actions}>
            <DepartmentAccessManager department="Stock" />
            {canEdit && (
              <button type="button" className={styles.primaryButton} onClick={openNewForm}>
                <FaPlus aria-hidden="true" /> New record
              </button>
            )}
          </div>
        </header>

        <nav className={styles.modelLinks} aria-label="Stock models">
          {models.map((entry) => (
            <Link
              key={entry.resource}
              className={entry.resource === model.resource ? styles.activeModelLink : styles.modelLink}
              to={`/stock/${entry.resource}`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {fieldsToDisplay.map((field) => <th key={field}>{field}</th>)}
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className={styles.emptyState} colSpan={fieldsToDisplay.length + (canEdit ? 1 : 0)}>Loading {model.label.toLowerCase()} records...</td></tr>
              ) : records.length === 0 ? (
                <tr><td className={styles.emptyState} colSpan={fieldsToDisplay.length + (canEdit ? 1 : 0)}>No records found.</td></tr>
              ) : records.map((record, index) => {
                const id = getId(record);
                return (
                  <tr key={id || `${model.resource}-${index}`}>
                    {fieldsToDisplay.map((field) => (
                      <td key={field}>{displayValue(record[field])}</td>
                    ))}
                    {canEdit && (
                      <td className={styles.rowActions}>
                        {model.qtyPatch && (
                          <button
                            type="button"
                            className={styles.quantityButton}
                            aria-label="Update quantity"
                            disabled={!id || saving}
                            onClick={() => {
                              setQtyRecord(record);
                              setNewQty(record.qty === undefined ? '' : String(record.qty));
                            }}
                          >
                            Qty
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.editButton}
                          aria-label={`Edit ${model.label}`}
                          disabled={!id || saving}
                          onClick={() => void openEditForm(record)}
                        >
                          <FaPencilAlt aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          aria-label={`Delete ${model.label}`}
                          disabled={!id || deletingId === id}
                          onClick={() => void deleteRecord(record)}
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="stock-form-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>{model.label.toUpperCase()}</p>
                <h2 id="stock-form-title">{editingId ? `Edit ${model.label}` : `New ${model.label}`}</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close form" disabled={saving} onClick={() => setModalOpen(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <div className={styles.formGrid}>
                {model.fields.map((field) => (
                  <label key={field.key}>
                    {field.key}{field.required ? ' *' : ''}
                    {field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={form[field.key] ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      >
                        <option value="">Select {field.key}</option>
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        required={field.required}
                        step={field.type === 'number' ? 'any' : undefined}
                        value={form[field.key] ?? ''}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
              <footer className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {editingId ? <FaPencilAlt aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                  {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create record'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {qtyRecord && (
        <div className={styles.modalOverlay} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setQtyRecord(null);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="stock-qty-title">
            <header className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>ORDER ENTRY</p><h2 id="stock-qty-title">Update quantity</h2></div>
              <button type="button" className={styles.closeButton} aria-label="Close quantity form" disabled={saving} onClick={() => setQtyRecord(null)}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={(event) => void submitQuantity(event)}>
              <label className={styles.quantityField}>
                New quantity
                <input type="number" min="0" step="any" required value={newQty} onChange={(event) => setNewQty(event.target.value)} />
              </label>
              <footer className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setQtyRecord(null)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? 'Saving...' : 'Update quantity'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

export default Stock;
