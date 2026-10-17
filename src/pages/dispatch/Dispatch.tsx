import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaMapMarkerAlt, FaPlus, FaTimes, FaPencilAlt, FaTrash } from 'react-icons/fa';
import styles from './Dispatch.module.scss';

type Location = {
  _id?: string;
  id?: string;
  name?: string;
};

type Item = {
  _id?: string;
  id?: string;
  mcode?: string;
  name?: string;
  description?: string;
  unit?: string;
  HSNCode?: string;
  dispatched?: number;
};

type ItemReference = Item | string;

type DispatchAccessory = {
  item?: ItemReference;
  quantity?: number;
};

type DispatchItemForm = {
  itemId: string;
  dispatched: string;
};

type DispatchRecord = {
  _id?: string;
  id?: string;
  challanNo: string;
  invoiceNo?: string;
  dateOfDelivery: string;
  type: string;
  description: string;
  item?: ItemReference;
  quantity?: number;
  HSNCode?: string;
  new?: string;
  REP?: string;
  DTRSerialNo?: string;
  rate?: number;
  gstno?: string;
  vehicleDetails?: string;
  partyName?: string;
  destination?: string;
  location?: string | Location;
  accessories?: DispatchAccessory[];
  createdAt?: string;
  updatedAt?: string;
};

type DispatchForm = {
  challanNo: string;
  invoiceNo: string;
  dateOfDelivery: string;
  type: string;
  description: string;
  itemId: string;
  quantity: string;
  HSNCode: string;
  new: string;
  REP: string;
  DTRSerialNo: string;
  rate: string;
  gstno: string;
  vehicleDetails: string;
  partyName: string;
  destination: string;
  locationId: string;
};

const emptyForm: DispatchForm = {
  challanNo: '',
  invoiceNo: '',
  dateOfDelivery: '',
  type: '',
  description: '',
  itemId: '',
  quantity: '',
  HSNCode: '',
  new: '',
  REP: '',
  DTRSerialNo: '',
  rate: '',
  gstno: '',
  vehicleDetails: '',
  partyName: '',
  destination: '',
  locationId: '',
};

const getResponseData = (data: unknown): unknown => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const nested = envelope.data ?? envelope.dispatches ?? envelope.dispatch;
    if (nested === undefined || nested === result) break;
    result = nested;
  }
  return result;
};

const getId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entity = value as { _id?: unknown; id?: unknown };
    return (typeof entity._id === 'string' && entity._id) ||
      (typeof entity.id === 'string' && entity.id) || null;
  }
  return null;
};

const getLocationName = (location: DispatchRecord['location']) =>
  typeof location === 'object' && location !== null
    ? location.name || getId(location) || '-'
    : location || '-';

const getItemName = (item: ItemReference | undefined) => {
  if (!item) return '-';
  if (typeof item === 'string') return item;
  const label = [item.mcode, item.name || item.description].filter(Boolean).join(' - ');
  return label || getId(item) || '-';
};

const getAccessorySummary = (accessories: DispatchAccessory[] | undefined) =>
  accessories?.length
    ? accessories.map(({ item, quantity }) => `${getItemName(item)} (${quantity ?? '-'})`).join(', ')
    : '-';

const getItemId = (item: ItemReference | undefined) => getId(item) || '';

const formatDate = (value: string | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

export default function Dispatch() {
  const isTypeA = localStorage.getItem('hbus_user_role') === 'A';
  const [records, setRecords] = useState<DispatchRecord[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [dispatchItems, setDispatchItems] = useState<DispatchItemForm[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => (isTypeA ? localStorage.getItem('hbus_selected_location_id') || 'ALL' : ''),
  );
  const currentUserId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');
  const [userLocationId, setUserLocationId] = useState('');
  const [loading, setLoading] = useState(isTypeA || Boolean(currentUserId));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<DispatchForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const locationId = isTypeA ? selectedLocationId : userLocationId;
  const itemsLocationId = modalOpen ? form.locationId : locationId;

  useEffect(() => {
    if (!modalOpen || !itemsLocationId || itemsLocationId === 'ALL') return;

    let active = true;
    axios.get(`${import.meta.env.VITE_APP_API}/api/items/location/${encodeURIComponent(itemsLocationId)}`)
      .then((response) => {
        const data = getResponseData(response.data);
        if (!Array.isArray(data)) throw new Error('Item response was not a list.');
        if (active) {
          const availableItems = data as Item[];
          setItems((current) => {
            const selectedItems = current.filter((currentItem) => {
              const currentItemId = getId(currentItem);
              return currentItemId && !availableItems.some((item) => getId(item) === currentItemId);
            });
            return [...availableItems, ...selectedItems];
          });
        }
      })
      .catch((requestError) => {
        console.error('Failed to load items for dispatch.', requestError);
        if (active) {
          setItems([]);
          toast.error('Failed to load items for this location.');
        }
      });
    return () => {
      active = false;
    };
  }, [itemsLocationId, modalOpen]);

  useEffect(() => {
    if (!isTypeA) return;
    axios.get(`${import.meta.env.VITE_APP_API}/api/location`)
      .then((response) => {
        const data = getResponseData(response.data);
        if (!Array.isArray(data)) throw new Error('Location response was not a list.');
        setLocations(data as Location[]);
      })
      .catch((requestError) => {
        console.error('Failed to load dispatch locations.', requestError);
        toast.error('Failed to load locations.');
      });
  }, [isTypeA]);

  useEffect(() => {
    if (isTypeA) return;
    if (!currentUserId) return;

    let active = true;
    axios.get(`${import.meta.env.VITE_APP_API}/api/users/${currentUserId}`)
      .then((response) => {
        const locationId = getId(response.data?.location);
        if (!locationId) throw new Error('No saved location is assigned to this user.');
        if (active) {
          setUserLocationId(locationId);
          setSelectedLocationId(locationId);
        }
      })
      .catch((requestError) => {
        console.error('Failed to load the user location for dispatches.', requestError);
        if (active) {
          setError('Unable to load your saved location.');
          setLoading(false);
          toast.error('Unable to load your saved location.');
        }
      });
    return () => {
      active = false;
    };
  }, [currentUserId, isTypeA]);

  const loadDispatches = useCallback(async () => {
    if (!isTypeA && !userLocationId) return;
    const locationId = isTypeA ? selectedLocationId : userLocationId;
    if (!locationId) return;

    try {
      const endpoint = locationId === 'ALL'
        ? '/api/dispatches'
        : `/api/dispatches/location/${encodeURIComponent(locationId)}`;
      const response = await axios.get(`${import.meta.env.VITE_APP_API}${endpoint}`);
      const data = getResponseData(response.data);
      if (!Array.isArray(data)) throw new Error('Dispatch response was not a list.');
      setError(null);
      setRecords(data as DispatchRecord[]);
    } catch (requestError) {
      console.error('Failed to load dispatch records.', requestError);
      setRecords([]);
      setError('Unable to load dispatch records. Please try again.');
      toast.error('Failed to load dispatch records.');
    } finally {
      setLoading(false);
    }
  }, [isTypeA, selectedLocationId, userLocationId]);

  useEffect(() => {
    void Promise.resolve().then(loadDispatches);
  }, [loadDispatches]);

  const changeLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setLoading(true);
    setError(null);
    if (locationId === 'ALL') {
      localStorage.removeItem('hbus_selected_location_id');
    } else {
      localStorage.setItem('hbus_selected_location_id', locationId);
    }
  };

  const openCreateForm = () => {
    if (!selectedLocationId || selectedLocationId === 'ALL') {
      toast.error('Select a specific location before creating a dispatch.');
      return;
    }
    setEditingRecordId(null);
    setForm({ ...emptyForm, locationId });
    setItems([]);
    setDispatchItems([]);
    setModalOpen(true);
  };

  const openEditForm = (record: DispatchRecord) => {
    const recordId = getId(record);
    if (!recordId) return;
    const itemId = getItemId(record.item);
    const quantity = record.quantity === undefined ? '' : String(record.quantity);
    const hasCompleteItemQuantityPair = Boolean(itemId) === (quantity !== '');
    const selectedItem = typeof record.item === 'object' && record.item !== null
      ? record.item
      : itemId ? { _id: itemId } : null;
    setEditingRecordId(recordId);
    setForm({
      challanNo: record.challanNo || '',
      invoiceNo: record.invoiceNo || '',
      dateOfDelivery: record.dateOfDelivery ? record.dateOfDelivery.slice(0, 10) : '',
      type: record.type || '',
      description: record.description || '',
      itemId: hasCompleteItemQuantityPair ? itemId : '',
      quantity: hasCompleteItemQuantityPair ? quantity : '',
      HSNCode: record.HSNCode || '',
      new: record.new || '',
      REP: record.REP || '',
      DTRSerialNo: record.DTRSerialNo || '',
      rate: record.rate === undefined ? '' : String(record.rate),
      gstno: record.gstno || '',
      vehicleDetails: record.vehicleDetails || '',
      partyName: record.partyName || '',
      destination: record.destination || '',
      locationId: getId(record.location) || locationId,
    });
    setItems(selectedItem ? [selectedItem] : []);
    setDispatchItems((record.accessories || []).map((accessory) => ({
      itemId: getItemId(accessory.item),
      dispatched: accessory.quantity === undefined ? '' : String(accessory.quantity),
    })));
    setModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.locationId || form.locationId === 'ALL') {
      toast.error('Select a specific location before creating a dispatch.');
      return;
    }
    if (form.quantity !== '' && (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) < 0)) {
      toast.error('Enter a valid non-negative quantity.');
      return;
    }
    if (form.rate !== '' && (!Number.isFinite(Number(form.rate)) || Number(form.rate) < 0)) {
      toast.error('Enter a valid non-negative rate.');
      return;
    }
    if (dispatchItems.some((item) => !item.itemId || item.dispatched === '')) {
      toast.error('Select an item and enter a dispatched quantity for each item.');
      return;
    }
    const accessoryPayload = dispatchItems.map((item) => ({
      item: item.itemId,
      quantity: Number(item.dispatched),
    }));
    setSaving(true);
    try {
      const payload = {
        challanNo: form.challanNo,
        invoiceNo: form.invoiceNo || undefined,
        dateOfDelivery: form.dateOfDelivery,
        type: form.type,
        description: form.description,
        item: form.itemId || undefined,
        quantity: form.quantity === '' ? undefined : Number(form.quantity),
        HSNCode: form.HSNCode || undefined,
        new: form.new || undefined,
        REP: form.REP || undefined,
        DTRSerialNo: form.DTRSerialNo || undefined,
        rate: form.rate === '' ? undefined : Number(form.rate),
        gstno: form.gstno || undefined,
        vehicleDetails: form.vehicleDetails || undefined,
        partyName: form.partyName || undefined,
        destination: form.destination || undefined,
        location: form.locationId,
        accessories: accessoryPayload.length ? accessoryPayload : undefined,
      };
      if (editingRecordId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/dispatches/${encodeURIComponent(editingRecordId)}`, payload);
        toast.success('Dispatch updated successfully.');
      } else {
        await axios.post(`${import.meta.env.VITE_APP_API}/api/dispatches`, payload);
        toast.success('Dispatch created successfully.');
      }
      setModalOpen(false);
      setEditingRecordId(null);
      await loadDispatches();
    } catch (requestError) {
      console.error(editingRecordId ? 'Failed to update dispatch.' : 'Failed to create dispatch.', requestError);
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || `Failed to ${editingRecordId ? 'update' : 'create'} dispatch.`
        : `Failed to ${editingRecordId ? 'update' : 'create'} dispatch.`;
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const setField = <Field extends keyof DispatchForm>(field: Field, value: DispatchForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setDispatchItemField = (index: number, field: keyof DispatchItemForm, value: string) => {
    setDispatchItems((current) => current.map((item, rowIndex) =>
      rowIndex === index ? { ...item, [field]: value } : item,
    ));
  };

  const deleteDispatch = async (recordId: string) => {
    if (!window.confirm('Delete this dispatch record? This action cannot be undone.')) return;
    setDeletingId(recordId);
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/dispatches/${encodeURIComponent(recordId)}`);
      setRecords((current) => current.filter((record) => getId(record) !== recordId));
      toast.success('Dispatch deleted.');
    } catch (requestError) {
      console.error('Failed to delete dispatch.', requestError);
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || 'Failed to delete dispatch.'
        : 'Failed to delete dispatch.';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>DISPATCH MANAGEMENT</p>
            <h1>Dispatches</h1>
            <p className={styles.subtitle}>Review delivery records and generate challans.</p>
          </div>
          <div className={styles.actions}>
            {isTypeA && (
              <label className={styles.locationControl}>
                <FaMapMarkerAlt aria-hidden="true" />
                <span className={styles.visuallyHidden}>Choose location</span>
                <select value={selectedLocationId} onChange={(event) => changeLocation(event.target.value)}>
                  <option value="ALL">All locations</option>
                  {locations.map((location) => {
                    const locationId = getId(location);
                    return locationId ? (
                      <option key={locationId} value={locationId}>{location.name || locationId}</option>
                    ) : null;
                  })}
                </select>
              </label>
            )}
            <button type="button" className={styles.primaryButton} onClick={openCreateForm}>
              <FaPlus aria-hidden="true" /> Create new
            </button>
            <Link to="/" className={styles.secondaryButton}><FaArrowLeft aria-hidden="true" /> Home</Link>
          </div>
        </header>

        {(error || (!isTypeA && !currentUserId ? 'Your user account could not be identified.' : null)) && (
          <div className={styles.error} role="alert">
            {error || 'Your user account could not be identified.'}
          </div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Challan No.</th>
                <th>Invoice No.</th>
                <th>Delivery Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>HSN Code</th>
                <th>New</th>
                <th>REP</th>
                <th>DTR Serial No.</th>
                <th>Rate</th>
                <th>GST No.</th>
                <th>Vehicle Details</th>
                <th>Party</th>
                <th>Destination</th>
                <th>Location</th>
                <th>Accessories (Item / Qty)</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th>Challan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={22} className={styles.emptyState}>Loading dispatches...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={22} className={styles.emptyState}>No dispatch records found.</td></tr>
              ) : records.map((record, index) => {
                const recordId = getId(record);
                return (
                  <tr key={recordId || `${record.challanNo}-${index}`}>
                    <td className={styles.strongCell}>{record.challanNo || '-'}</td>
                    <td>{record.invoiceNo || '-'}</td>
                    <td>{formatDate(record.dateOfDelivery)}</td>
                    <td><span className={styles.typeBadge}>{record.type}</span></td>
                    <td className={styles.descriptionCell}>{record.description || '-'}</td>
                    <td>{getItemName(record.item)}</td>
                    <td>{record.quantity ?? '-'}</td>
                    <td>{record.HSNCode || '-'}</td>
                    <td>{record.new || '-'}</td>
                    <td>{record.REP || '-'}</td>
                    <td>{record.DTRSerialNo || '-'}</td>
                    <td>{record.rate ?? '-'}</td>
                    <td>{record.gstno || '-'}</td>
                    <td>{record.vehicleDetails || '-'}</td>
                    <td>{record.partyName || '-'}</td>
                    <td>{record.destination || '-'}</td>
                    <td>{getLocationName(record.location)}</td>
                    <td className={styles.descriptionCell}>{getAccessorySummary(record.accessories)}</td>
                    <td>{formatDate(record.createdAt)}</td>
                    <td>{formatDate(record.updatedAt)}</td>
                    <td>
                      {recordId ? (
                        <Link className={styles.challanButton} to={`/dispatch/${recordId}`}>Generate challan</Link>
                      ) : 'Unavailable'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.editButton}
                        aria-label="Edit dispatch"
                        disabled={!recordId || saving}
                        onClick={() => openEditForm(record)}
                      >
                        <FaPencilAlt aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        aria-label="Delete dispatch"
                        disabled={!recordId || deletingId === recordId}
                        onClick={() => recordId && void deleteDispatch(recordId)}
                      >
                        <FaTrash aria-hidden="true" />
                        {deletingId === recordId ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
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
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dispatch-form-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>NEW RECORD</p>
                <h2 id="dispatch-form-title">{editingRecordId ? 'Edit dispatch' : 'Create dispatch'}</h2>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Close form" onClick={() => {
                if (!saving) {
                  setModalOpen(false);
                  setEditingRecordId(null);
                }
              }}>
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                {isTypeA ? (
                  <label>Location *
                    <select required value={form.locationId} onChange={(event) => setField('locationId', event.target.value)}>
                      <option value="">Select location</option>
                      {locations.map((location) => {
                        const id = getId(location);
                        return id ? <option key={id} value={id}>{location.name || id}</option> : null;
                      })}
                    </select>
                  </label>
                ) : (
                  <label>Location
                    <input readOnly value={getLocationName(form.locationId)} />
                  </label>
                )}
                <label>Type *
                  <input required value={form.type} onChange={(event) => setField('type', event.target.value)} />
                </label>
                <label>Challan number *
                  <input required value={form.challanNo} onChange={(event) => setField('challanNo', event.target.value)} />
                </label>
                <label>Invoice number
                  <input value={form.invoiceNo} onChange={(event) => setField('invoiceNo', event.target.value)} />
                </label>
                <label>Date of delivery *
                  <input type="date" required value={form.dateOfDelivery} onChange={(event) => setField('dateOfDelivery', event.target.value)} />
                </label>
                <label className={styles.fullWidth}>Description *
                  <textarea required rows={3} value={form.description} onChange={(event) => setField('description', event.target.value)} />
                </label>
                <label>Item
                  <select value={form.itemId} onChange={(event) => {
                    const itemId = event.target.value;
                    setField('itemId', itemId);
                    if (!itemId) setField('quantity', '');
                  }}>
                    <option value="">No item selected</option>
                    {items.map((item) => (
                      <option key={getId(item) || item.mcode} value={getId(item) || ''}>
                        {getItemName(item)}{item.unit ? ` (${item.unit})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Quantity
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required={Boolean(form.itemId)}
                    disabled={!form.itemId}
                    value={form.quantity}
                    onChange={(event) => setField('quantity', event.target.value)}
                  />
                </label>
                <label>HSN code
                  <input value={form.HSNCode} onChange={(event) => setField('HSNCode', event.target.value)} />
                </label>
                <label>New
                  <input value={form.new} onChange={(event) => setField('new', event.target.value)} />
                </label>
                <label>REP
                  <input value={form.REP} onChange={(event) => setField('REP', event.target.value)} />
                </label>
                <label>DTR serial number
                  <input value={form.DTRSerialNo} onChange={(event) => setField('DTRSerialNo', event.target.value)} />
                </label>
                <label>Rate
                  <input type="number" min="0" step="any" value={form.rate} onChange={(event) => setField('rate', event.target.value)} />
                </label>
                <label>GST number
                  <input value={form.gstno} onChange={(event) => setField('gstno', event.target.value)} />
                </label>
                <label>Vehicle details
                  <input value={form.vehicleDetails} onChange={(event) => setField('vehicleDetails', event.target.value)} />
                </label>
                <label>Party name   
                  <input value={form.partyName} onChange={(event) => setField('partyName', event.target.value)} />
                </label>
                <label>Destination
                  <input value={form.destination} onChange={(event) => setField('destination', event.target.value)} />
                </label>
                <section className={`${styles.fullWidth} ${styles.accessorySection}`} aria-label="Items to dispatch">
                  <div className={styles.accessoryHeader}>
                    <strong>Accessories to dispatch</strong>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setDispatchItems((current) => [...current, { itemId: '', dispatched: '' }])}
                    >
                      <FaPlus aria-hidden="true" /> Add item
                    </button>
                  </div>
                  {dispatchItems.map((dispatchItem, index) => (
                    <div className={styles.accessoryRow} key={index}>
                      <label>Item *
                        <select required value={dispatchItem.itemId} onChange={(event) => setDispatchItemField(index, 'itemId', event.target.value)}>
                          <option value="">Select item</option>
                          {items.map((item) => (
                            <option key={getId(item) || `${item.mcode}-${index}`} value={getId(item) || ''}>
                              {getItemName(item)}{item.unit ? ` (${item.unit})` : ''} - dispatched: {item.dispatched ?? 0}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>Dispatched quantity *
                        <input
                          required
                          type="number"
                          min="0"
                          step="any"
                          value={dispatchItem.dispatched}
                          onChange={(event) => setDispatchItemField(index, 'dispatched', event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.removeAccessoryButton}
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => setDispatchItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      >
                        <FaTimes aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </section>
              </div>
              <footer className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => {
                  setModalOpen(false);
                  setEditingRecordId(null);
                }}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {editingRecordId ? <FaPencilAlt aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                  {saving ? (editingRecordId ? 'Saving...' : 'Creating...') : (editingRecordId ? 'Save changes' : 'Create dispatch')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
