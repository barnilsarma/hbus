import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FaArrowLeft, FaPlus, FaPencilAlt, FaTrash, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import styles from './Booking.module.scss';

type Location = {
  _id?: string;
  id?: string;
  name?: string;
};

type BookingRecord = {
  _id?: string;
  id?: string;
  date?: string;
  status?: 'BOOKING' | 'DELIVERED' | 'CANCELLED';
  KvaDesign?: string;
  qty?: number;
  cutsomer?: string;
  address?: string;
  contact?: string;
  advancePayment?: number;
  remarks?: string;
  location?: string | Location;
};

type BookingForm = {
  date: string;
  status: string;
  KvaDesign: string;
  qty: string;
  cutsomer: string;
  address: string;
  contact: string;
  advancePayment: string;
  remarks: string;
  locationId: string;
};

const emptyForm: BookingForm = {
  date: '',
  status: 'BOOKING',
  KvaDesign: '',
  qty: '',
  cutsomer: '',
  address: '',
  contact: '',
  advancePayment: '',
  remarks: '',
  locationId: '',
};

const columns = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'KvaDesign', label: 'KVA Design', type: 'text' },
  { key: 'qty', label: 'Quantity', type: 'number' },
  { key: 'cutsomer', label: 'Customer', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'contact', label: 'Contact', type: 'text' },
  { key: 'advancePayment', label: 'Advance Payment', type: 'number' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
] as const;

type ColumnKey = (typeof columns)[number]['key'];

const getResponseData = (data: unknown): unknown => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const nested = envelope.data ?? envelope.bookings ?? envelope.booking;
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

const getLocationName = (location: BookingRecord['location']) =>
  typeof location === 'object' && location !== null
    ? location.name || getId(location) || '-'
    : location || '-';

const getColumnValue = (record: BookingRecord, key: ColumnKey): string => {
  if (key === 'location') return String(getLocationName(record.location));
  const value = record[key];
  return value === undefined || value === null ? '' : String(value);
};

const formatDate = (value: string | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

export default function Booking() {
  const isAdmin = localStorage.getItem('hbus_user_role') === 'A';
  const currentUserId = localStorage.getItem('hbus_user_id') || localStorage.getItem('userId');
  const [records, setRecords] = useState<BookingRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => (isAdmin ? localStorage.getItem('hbus_selected_location_id') || 'ALL' : ''),
  );
  const [userLocationId, setUserLocationId] = useState('');
  const [filters, setFilters] = useState<Record<ColumnKey, string>>({
    date: '',
    status: '',
    KvaDesign: '',
    qty: '',
    cutsomer: '',
    address: '',
    contact: '',
    advancePayment: '',
    remarks: '',
    location: '',
  });
  const [loading, setLoading] = useState(isAdmin || Boolean(currentUserId));
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>(emptyForm);

  useEffect(() => {
    if (isAdmin) {
      axios.get(`${import.meta.env.VITE_APP_API}/api/location`)
        .then((response) => {
          const data = getResponseData(response.data);
          if (!Array.isArray(data)) throw new Error('Location response was not a list.');
          setLocations(data as Location[]);
        })
        .catch((requestError) => {
          console.error('Failed to load booking locations.', requestError);
          toast.error('Failed to load locations.');
        });
      return;
    }

    if (!currentUserId) {
      return;
    }

    let active = true;
    axios.get(`${import.meta.env.VITE_APP_API}/api/users/${encodeURIComponent(currentUserId)}`)
      .then((response) => {
        const locationId = getId(response.data?.location);
        if (!locationId) throw new Error('No saved location is assigned to this user.');
        if (active) {
          setUserLocationId(locationId);
          setSelectedLocationId(locationId);
        }
      })
      .catch((requestError) => {
        console.error('Failed to load the user location for bookings.', requestError);
        if (active) {
          setError('Unable to load your saved location.');
          setLoading(false);
          toast.error('Unable to load your saved location.');
        }
      });
    return () => {
      active = false;
    };
  }, [currentUserId, isAdmin]);

  const loadBookings = useCallback(async () => {
    const locationId = isAdmin ? selectedLocationId : userLocationId;
    if (!locationId) return;
    setLoading(true);
    try {
      const endpoint = locationId === 'ALL'
        ? '/api/bookings'
        : `/api/bookings/location/${encodeURIComponent(locationId)}`;
      const response = await axios.get(`${import.meta.env.VITE_APP_API}${endpoint}`);
      const data = getResponseData(response.data);
      if (!Array.isArray(data)) throw new Error('Booking response was not a list.');
      setError(null);
      setRecords(data as BookingRecord[]);
    } catch (requestError) {
      console.error('Failed to load booking records.', requestError);
      setRecords([]);
      setError('Unable to load booking records. Please try again.');
      toast.error('Failed to load booking records.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, selectedLocationId, userLocationId]);

  useEffect(() => {
    void Promise.resolve().then(loadBookings);
  }, [loadBookings]);

  const filteredRecords = useMemo(() => records.filter((record) => columns.every(({ key, type }) => {
    const filter = filters[key].trim().toLocaleLowerCase();
    if (!filter) return true;
    const value = getColumnValue(record, key);
    if (type === 'date') return value.slice(0, 10) === filter;
    return value.toLocaleLowerCase().includes(filter);
  })), [filters, records]);

  const openCreateForm = () => {
    const locationId = isAdmin ? selectedLocationId : userLocationId;
    if (!locationId || locationId === 'ALL') {
      toast.error('Select a specific location before creating a booking.');
      return;
    }
    setEditingRecordId(null);
    setForm({ ...emptyForm, locationId });
    setModalOpen(true);
  };

  const openEditForm = (record: BookingRecord) => {
    const recordId = getId(record);
    if (!recordId) return;
    setEditingRecordId(recordId);
    setForm({
      date: record.date ? record.date.slice(0, 10) : '',
      status: record.status || 'BOOKING',
      KvaDesign: record.KvaDesign || '',
      qty: record.qty === undefined ? '' : String(record.qty),
      cutsomer: record.cutsomer || '',
      address: record.address || '',
      contact: record.contact || '',
      advancePayment: record.advancePayment === undefined ? '' : String(record.advancePayment),
      remarks: record.remarks || '',
      locationId: getId(record.location) || (isAdmin ? selectedLocationId : userLocationId),
    });
    setModalOpen(true);
  };

  const setField = <Field extends keyof BookingForm>(field: Field, value: BookingForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.locationId || form.locationId === 'ALL') {
      toast.error('Select a specific location before saving a booking.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: form.date || undefined,
        status: form.status,
        KvaDesign: form.KvaDesign.trim(),
        qty: Number(form.qty),
        cutsomer: form.cutsomer.trim(),
        address: form.address.trim() || undefined,
        contact: form.contact.trim() || undefined,
        advancePayment: form.advancePayment === '' ? undefined : Number(form.advancePayment),
        remarks: form.remarks.trim() || undefined,
        location: form.locationId,
      };
      if (editingRecordId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/bookings/${encodeURIComponent(editingRecordId)}`, payload);
        toast.success('Booking updated successfully.');
      } else {
        await axios.post(`${import.meta.env.VITE_APP_API}/api/bookings`, payload);
        toast.success('Booking created successfully.');
      }
      setModalOpen(false);
      setEditingRecordId(null);
      await loadBookings();
    } catch (requestError) {
      console.error(editingRecordId ? 'Failed to update booking.' : 'Failed to create booking.', requestError);
      toast.error(getErrorMessage(requestError, `Failed to ${editingRecordId ? 'update' : 'create'} booking.`));
    } finally {
      setSaving(false);
    }
  };

  const deleteBooking = async (recordId: string) => {
    if (!window.confirm('Delete this booking record? This action cannot be undone.')) return;
    setDeletingId(recordId);
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/bookings/${encodeURIComponent(recordId)}`);
      setRecords((current) => current.filter((record) => getId(record) !== recordId));
      toast.success('Booking deleted.');
    } catch (requestError) {
      console.error('Failed to delete booking.', requestError);
      toast.error(getErrorMessage(requestError, 'Failed to delete booking.'));
    } finally {
      setDeletingId(null);
    }
  };

  const changeLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    if (locationId === 'ALL') localStorage.removeItem('hbus_selected_location_id');
    else localStorage.setItem('hbus_selected_location_id', locationId);
  };

  const editingLocation = records.find((record) => getId(record) === editingRecordId)?.location;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>BOOKING MANAGEMENT</p>
            <h1>Bookings</h1>
            <p className={styles.subtitle}>Review, filter, and manage booking records.</p>
          </div>
          <div className={styles.actions}>
            {isAdmin && (
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
              <FaPlus aria-hidden="true" /> Create booking
            </button>
            <Link to="/" className={styles.secondaryButton}><FaArrowLeft aria-hidden="true" /> Home</Link>
          </div>
        </header>

        {(error || (!isAdmin && !currentUserId ? 'Your user account could not be identified.' : null)) && (
          <div className={styles.error} role="alert">
            {error || 'Your user account could not be identified.'}
          </div>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                <th>Actions</th>
              </tr>
              <tr className={styles.filterRow}>
                {columns.map((column) => (
                  <th key={column.key}>
                    {column.type === 'status' ? (
                      <select
                        aria-label={`Filter by ${column.label}`}
                        value={filters[column.key]}
                        onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}
                      >
                        <option value="">All statuses</option>
                        <option value="BOOKING">Booking</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    ) : (
                      <input
                        aria-label={`Filter by ${column.label}`}
                        type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'search'}
                        placeholder={column.type === 'date' ? undefined : 'Filter'}
                        value={filters[column.key]}
                        onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}
                      />
                    )}
                  </th>
                ))}
                <th>
                  <button
                    type="button"
                    className={styles.clearFilters}
                    onClick={() => setFilters({
                      date: '', status: '', KvaDesign: '', qty: '', cutsomer: '',
                      address: '', contact: '', advancePayment: '', remarks: '', location: '',
                    })}
                  >
                    Clear
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className={styles.emptyState}>Loading bookings...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={11} className={styles.emptyState}>No booking records found.</td></tr>
              ) : filteredRecords.map((record, index) => {
                const recordId = getId(record);
                return (
                  <tr key={recordId || `${record.cutsomer}-${index}`}>
                    <td>{formatDate(record.date)}</td>
                    <td><span className={styles.statusBadge}>{record.status || 'BOOKING'}</span></td>
                    <td className={styles.strongCell}>{record.KvaDesign || '-'}</td>
                    <td>{record.qty ?? '-'}</td>
                    <td>{record.cutsomer || '-'}</td>
                    <td className={styles.descriptionCell}>{record.address || '-'}</td>
                    <td>{record.contact || '-'}</td>
                    <td>{record.advancePayment ?? '-'}</td>
                    <td className={styles.descriptionCell}>{record.remarks || '-'}</td>
                    <td>{getLocationName(record.location)}</td>
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.editButton}
                        disabled={!recordId || saving}
                        onClick={() => openEditForm(record)}
                      >
                        <FaPencilAlt aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        disabled={!recordId || deletingId === recordId}
                        onClick={() => recordId && void deleteBooking(recordId)}
                      >
                        <FaTrash aria-hidden="true" /> {deletingId === recordId ? 'Deleting...' : 'Delete'}
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
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="booking-form-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>BOOKING RECORD</p>
                <h2 id="booking-form-title">{editingRecordId ? 'Edit booking' : 'Create booking'}</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close form"
                onClick={() => { if (!saving) setModalOpen(false); }}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </header>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                {isAdmin ? (
                  <label>Location *
                    <select required value={form.locationId} onChange={(event) => setField('locationId', event.target.value)}>
                      <option value="">Select location</option>
                      {locations.map((location) => {
                        const locationId = getId(location);
                        return locationId ? (
                          <option key={locationId} value={locationId}>{location.name || locationId}</option>
                        ) : null;
                      })}
                    </select>
                  </label>
                ) : (
                  <label>Location
                    <input value={editingLocation ? getLocationName(editingLocation) : 'Your assigned location'} disabled />
                  </label>
                )}
                <label>Date
                  <input type="date" value={form.date} onChange={(event) => setField('date', event.target.value)} />
                </label>
                <label>Status *
                  <select required value={form.status} onChange={(event) => setField('status', event.target.value)}>
                    <option value="BOOKING">Booking</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                <label>KVA Design *
                  <input required value={form.KvaDesign} onChange={(event) => setField('KvaDesign', event.target.value)} />
                </label>
                <label>Quantity *
                  <input required type="number" min="1" step="1" value={form.qty} onChange={(event) => setField('qty', event.target.value)} />
                </label>
                <label>Customer *
                  <input required value={form.cutsomer} onChange={(event) => setField('cutsomer', event.target.value)} />
                </label>
                <label>Contact
                  <input value={form.contact} onChange={(event) => setField('contact', event.target.value)} />
                </label>
                <label>Advance payment
                  <input type="number" min="0" step="any" value={form.advancePayment} onChange={(event) => setField('advancePayment', event.target.value)} />
                </label>
                <label className={styles.fullWidth}>Address
                  <textarea rows={2} value={form.address} onChange={(event) => setField('address', event.target.value)} />
                </label>
                <label className={styles.fullWidth}>Remarks
                  <textarea rows={3} value={form.remarks} onChange={(event) => setField('remarks', event.target.value)} />
                </label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? 'Saving...' : editingRecordId ? 'Save changes' : 'Create booking'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
