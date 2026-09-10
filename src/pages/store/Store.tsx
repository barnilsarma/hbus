import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaPlus, FaPencilAlt, FaTrash, FaTimes } from 'react-icons/fa';
import styles from './Store.module.scss';

export interface Location {
  _id: string;
  name: string;
  address?: string;
}

export interface Item {
  _id?: string;
  mcode: string;
  description: string;
  gst: number;
  unit: string;
  rate: number;
  qty: number;
  location?: Location | string;
}

const initialItemState: Item = {
  mcode: '',
  description: '',
  gst: 18,
  unit: 'NOS',
  rate: 0,
  qty: 0,
};

const Store: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Item>(initialItemState);

  const fetchItemsByLocation = async (locationId: string) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API}/api/items/location/${locationId}`
      );
      console.log(response.data);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items for location:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const type = localStorage.getItem('user_type') || parsedUser?.type || parsedUser?.role || '';
    setUserType(type);

    const savedLocationId = localStorage.getItem('hbus_selected_location_id') || '';
    setSelectedLocationId(savedLocationId);

    if (type === 'A') {
      axios
        .get(`${import.meta.env.VITE_APP_API}/api/locations`)
        .then((response) => {
          setLocations(response.data);
          if (savedLocationId && response.data.some((loc: Location) => loc._id === savedLocationId)) {
            setSelectedLocationId(savedLocationId);
          } else if (response.data.length > 0) {
            setSelectedLocationId(response.data[0]._id);
          }
        })
        .catch((error) => console.error('Error fetching locations:', error));
    } else {
      setSelectedLocationId(savedLocationId);
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      fetchItemsByLocation(selectedLocationId);
    } else {
      setLoading(false);
    }
  }, [selectedLocationId]);

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocationId = e.target.value;
    setSelectedLocationId(newLocationId);
    localStorage.setItem('hbus_selected_location_id', newLocationId);
  };

  const handleOpenAddModal = () => {
    setEditingItemId(null);
    setItemForm(initialItemState);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Item) => {
    setEditingItemId(item._id || null);
    setItemForm({
      mcode: item.mcode,
      description: item.description,
      gst: item.gst,
      unit: item.unit,
      rate: item.rate,
      qty: item.qty ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) {
      alert('Please select or set a location first.');
      return;
    }

    // Default quantity to 0 if null, undefined, or empty
    const sanitizedQty =
      itemForm.qty !== undefined && itemForm.qty !== null && !isNaN(Number(itemForm.qty))
        ? Number(itemForm.qty)
        : 0;

    const payload = {
      ...itemForm,
      qty: sanitizedQty,
      location: selectedLocationId,
    };

    try {
      if (editingItemId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/items/${editingItemId}`, payload);
      } else {
        await axios.post(`${import.meta.env.VITE_APP_API}/api/items`, payload);
      }

      setIsModalOpen(false);
      fetchItemsByLocation(selectedLocationId);
    } catch (error: any) {
      console.error('Error saving item:', error);
      alert(error.response?.data?.message || 'Failed to save item.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/items/${itemId}`);
      fetchItemsByLocation(selectedLocationId);
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert(error.response?.data?.message || 'Failed to delete item.');
    }
  };
  const filteredItems = items.filter(
    (item) =>
      item.mcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.storeContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Store Catalogue</h1>

        <div className={styles.controls}>
          {userType === 'A' && (
            <div className={styles.locationGroup}>
              <label htmlFor="locationSelect">Location:</label>
              <select
                id="locationSelect"
                value={selectedLocationId}
                onChange={handleLocationChange}
              >
                <option value="" disabled>
                  Select a Location
                </option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            className={styles.addBtn}
            onClick={handleOpenAddModal}
            disabled={!selectedLocationId}
          >
            <FaPlus /> Add Item
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.statusMessage}>Loading items...</p>
      ) : !selectedLocationId ? (
        <p className={`${styles.statusMessage} ${styles.error}`}>
          No location selected. Please select or set a location.
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th className={styles.colSl}>Sl No</th>
                <th className={styles.colMcode}>Material Code</th>
                <th>Description</th>
                <th className={styles.colGst}>GST (%)</th>
                <th className={styles.colUnit}>Unit</th>
                <th className={styles.colRate}>Rate (₹)</th>
                <th className={styles.colQty}>Quantity</th>
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <tr key={item._id}>
                    <td className={styles.slNo}>{index + 1}</td>
                    <td className={styles.mcode}>{item.mcode}</td>
                    <td className={styles.desc}>{item.description}</td>
                    <td className={styles.gst}>{item.gst}%</td>
                    <td className={styles.unit}>{item.unit}</td>
                    <td className={styles.rate}>
                      {Number(item.rate).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={styles.qty}>{item.qty ?? 0}</td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionBtns}>
                        <button
                          className={styles.editBtn}
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit Item"
                        >
                          <FaPencilAlt />
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => item._id && handleDeleteItem(item._id)}
                          title="Delete Item"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    No items found for this location.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Material Code *</label>
                <input
                  type="text"
                  required
                  value={itemForm.mcode}
                  onChange={(e) => setItemForm({ ...itemForm, mcode: e.target.value })}
                  placeholder="e.g. M001"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Item Description *</label>
                <textarea
                  rows={3}
                  required
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Enter detailed description..."
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>GST (%) *</label>
                  <input
                    type="number"
                    required
                    value={itemForm.gst}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        gst: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Unit *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="e.g. NOS, KG"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemForm.rate}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        rate: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Quantity</label>
                  <input
                    type="number"
                    value={itemForm.qty}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        qty: e.target.value === '' ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0 if left empty"
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  {editingItemId ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;