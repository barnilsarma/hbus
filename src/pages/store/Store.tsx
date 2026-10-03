import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FaPlus, FaPencilAlt, FaTrash, FaTimes, FaCheck } from 'react-icons/fa';
import styles from './Store.module.scss';

export interface Location {
  _id: string;
  name: string;
  address?: string;
}

type ItemType = 'PRIMARY' | 'SECONDARY';

export interface Item {
  _id?: string;
  type?: ItemType;
  mcode: string;
  description: string;
  gst: number;
  unit: string;
  rate: number;
  qty: number;
  newQty?: number | string;
  receivedqtyOriginal?: number | string;
  receivedqtyNew?: number | string;
  location?: Location | string;
}

type ItemForm = Omit<Item, 'type'> & {
  type: ItemType | '';
};

type PurchaseOrder = {
  _id?: string;
  id?: string;
  PONumber?: string;
  supplier?: string;
  status?: string;
  location?: Location | string;
  locationId?: string;
  locationID?: string;
  items?: Array<Item | string>;
};

type ReceiptRow = {
  key: string;
  purchaseOrder: PurchaseOrder;
  item: Item;
};

const getEntityId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entity = value as { _id?: unknown; id?: unknown };
    return (typeof entity._id === 'string' && entity._id) || (typeof entity.id === 'string' && entity.id) || null;
  }
  return null;
};

const getLocationId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const location = value as { _id?: unknown; id?: unknown };
    return (typeof location._id === 'string' && location._id) || (typeof location.id === 'string' && location.id) || null;
  }
  return null;
};

const getPurchaseLocationId = (purchase: PurchaseOrder): string | null =>
  getLocationId(purchase.location) ??
  getLocationId(purchase.locationId) ??
  getLocationId(purchase.locationID);

const getResponseData = (responseData: any) => responseData?.data ?? responseData?.purchase ?? responseData;

const initialItemState: ItemForm = {
  type: '',
  mcode: '',
  description: '',
  gst: 18,
  unit: 'NOS',
  rate: 0,
  qty: 0,
  newQty: 0,
  receivedqtyOriginal: 0,
  receivedqtyNew: 0,
};

const Store: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [activePurchaseOrders, setActivePurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receivedQtyInputs, setReceivedQtyInputs] = useState<Record<string, string>>({});
  const [savingReceiptItemId, setSavingReceiptItemId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(initialItemState);

  const fetchItemsByLocation = async (locationId: string) => {
    setLoading(true);

    // Check active POs first, then load each PO's populated item details.
    let purchaseOrders: PurchaseOrder[] = [];
    try {
      const purchasesResponse = await axios.get(`${import.meta.env.VITE_APP_API}/api/purchases`);
      const purchasesData = getResponseData(purchasesResponse.data);
      const allPurchases: PurchaseOrder[] = Array.isArray(purchasesData) ? purchasesData : [];
      const activePurchases = allPurchases.filter((purchase) => {
        const status = (purchase.status || '').trim().toUpperCase();
        return status !== 'COMPLETE' && getPurchaseLocationId(purchase) === locationId;
      });

      purchaseOrders = await Promise.all(
        activePurchases.map(async (purchase) => {
          const purchaseId = getEntityId(purchase);
          if (!purchaseId) return purchase;

          try {
            const detailResponse = await axios.get(
              `${import.meta.env.VITE_APP_API}/api/purchases/${purchaseId}`,
            );
            const purchaseDetails = getResponseData(detailResponse.data) as PurchaseOrder;
            return {
              ...purchase,
              ...purchaseDetails,
              location: purchaseDetails.location ?? purchase.location,
              locationId: purchaseDetails.locationId ?? purchase.locationId,
              locationID: purchaseDetails.locationID ?? purchase.locationID,
            };
          } catch (error) {
            console.error(`Error loading purchase order ${purchaseId}:`, error);
            return purchase;
          }
        }),
      );
    } catch (error) {
      console.error('Error checking active purchase orders:', error);
      toast.error('Could not check active purchase orders.');
    }

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API}/api/items/location/${locationId}`,
      );
      const responseItems = getResponseData(response.data);
      const locationItems: Item[] = Array.isArray(responseItems)
        ? responseItems
        : [];
      const itemIds = new Set(locationItems.map((item) => item._id).filter(Boolean));

      setItems(locationItems);
      setActivePurchaseOrders(
        purchaseOrders.filter((purchase) => {
          const purchaseItems = Array.isArray(purchase.items) ? purchase.items : [];
          const hasItemsInStore = purchaseItems.some((purchaseItem) => {
            const purchaseItemId = getEntityId(purchaseItem);
            return Boolean(purchaseItemId && itemIds.has(purchaseItemId));
          });

          return getPurchaseLocationId(purchase) === locationId && hasItemsInStore;
        }),
      );
    } catch (error) {
      console.error('Error fetching items for location:', error);
      toast.error('Failed to load items for this location.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const type = (
      localStorage.getItem('hbus_user_role') ||
      localStorage.getItem('user_type') ||
      parsedUser?.type ||
      parsedUser?.role ||
      ''
    )
      .trim()
      .toUpperCase();
    setUserType(type);

    const savedLocationId = localStorage.getItem('hbus_selected_location_id') || '';

    if (type === 'A') {
      axios
        .get(`${import.meta.env.VITE_APP_API}/api/location`)
        .then((response) => {
          const locationsData = getResponseData(response.data);
          const availableLocations: Location[] = Array.isArray(locationsData)
            ? locationsData
            : Array.isArray(locationsData?.locations)
              ? locationsData.locations
            : [];
          setLocations(availableLocations);
          const savedLocationIsValid = availableLocations.some(
            (location) => location._id === savedLocationId,
          );
          const nextLocationId = savedLocationIsValid
            ? savedLocationId
            : availableLocations[0]?._id || '';
          setSelectedLocationId(nextLocationId);
          if (nextLocationId) {
            localStorage.setItem('hbus_selected_location_id', nextLocationId);
          } else {
            localStorage.removeItem('hbus_selected_location_id');
          }
        })
        .catch((error) => {
          console.error('Error fetching locations:', error);
          toast.error('Failed to load locations.');
        });
    } else {
      const validSavedLocationId = savedLocationId && savedLocationId !== 'ALL'
        ? savedLocationId
        : '';
      setSelectedLocationId(validSavedLocationId);
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      fetchItemsByLocation(selectedLocationId);
    } else {
      setItems([]);
      setActivePurchaseOrders([]);
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
      type: item.type || '',
      mcode: item.mcode,
      description: item.description,
      gst: item.gst,
      unit: item.unit,
      rate: item.rate,
      qty: item.qty ?? 0,
      newQty: item.newQty ?? 0,
      receivedqtyOriginal: item.receivedqtyOriginal ?? 0,
      receivedqtyNew: item.receivedqtyNew ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) {
      alert('Please select or set a location first.');
      return;
    }
    if (!itemForm.type) {
      toast.error('Please select an item type.');
      return;
    }

    // Default quantity to 0 if null, undefined, or empty
    const sanitizedQty =
      itemForm.qty !== undefined && itemForm.qty !== null && !isNaN(Number(itemForm.qty))
        ? Number(itemForm.qty)
        : 0;

    const payload = {
      type: itemForm.type,
      mcode: itemForm.mcode,
      description: itemForm.description,
      gst: itemForm.gst,
      unit: itemForm.unit,
      rate: itemForm.rate,
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

  const handleUpdateReceivedQty = async (
    itemId: string,
    currentReceivedQty: number,
    orderedQty: number,
  ) => {
    const inputValue = receivedQtyInputs[itemId] ?? String(currentReceivedQty);
    const qtyToUpdate = Number(inputValue);
    if (inputValue.trim() === '' || !Number.isFinite(qtyToUpdate) || qtyToUpdate < 0) {
      toast.error('Enter a valid received quantity.');
      return;
    }
    if (qtyToUpdate > orderedQty) {
      toast.error('Received quantity cannot exceed the quantity ordered.');
      return;
    }

    setSavingReceiptItemId(itemId);
    try {
      const response = await axios.put<Item>(
        `${import.meta.env.VITE_APP_API}/api/items/receivedqty/${itemId}`,
        {
          receivedqtyNew: qtyToUpdate,
        },
      );
      const updatedItem = response.data;
      const updatedReceivedQty = Number(updatedItem.receivedqtyNew ?? qtyToUpdate);

      setItems((currentItems) =>
        currentItems.map((item) =>
          item._id === itemId ? { ...item, ...updatedItem } : item,
        ),
      );
      setActivePurchaseOrders((currentPurchases) =>
        currentPurchases.map((purchase) => ({
          ...purchase,
          items: purchase.items?.map((purchaseItem) =>
            getEntityId(purchaseItem) === itemId && typeof purchaseItem === 'object'
              ? { ...purchaseItem, ...updatedItem }
              : purchaseItem,
          ),
        })),
      );
      setReceivedQtyInputs((currentInputs) => ({
        ...currentInputs,
        [itemId]: String(updatedReceivedQty),
      }));
      toast.success('Received quantity updated.');
    } catch (error: any) {
      console.error('Error updating received quantity:', error);
      toast.error(error.response?.data?.message || 'Failed to update received quantity.');
    } finally {
      setSavingReceiptItemId(null);
    }
  };

  const receiptRows: ReceiptRow[] = activePurchaseOrders.flatMap((purchaseOrder, purchaseIndex) => {
    const purchaseItems = Array.isArray(purchaseOrder.items) ? purchaseOrder.items : [];
    return purchaseItems.flatMap((purchaseItem, itemIndex) => {
      const itemId = getEntityId(purchaseItem);
      const catalogueItem = items.find((item) => item._id === itemId);
      const purchaseItemDetails =
        purchaseItem && typeof purchaseItem === 'object' ? purchaseItem : undefined;
      if (!itemId || !catalogueItem || catalogueItem.type !== 'SECONDARY') return [];

      const item = {
        ...(purchaseItemDetails || {}),
        ...catalogueItem,
        _id: itemId,
      } as Item;
      const purchaseOrderId = getEntityId(purchaseOrder) || `purchase-${purchaseIndex}`;

      return [{
        key: `${purchaseOrderId}-${itemId}-${itemIndex}`,
        purchaseOrder,
        item,
      }];
    });
  });

  const normalizedSearchTerm = searchTerm.toLowerCase();
  const filteredItems = items.filter((item) => {
    if (item.type !== 'SECONDARY') return false;
    return (
      item.mcode?.toLowerCase().includes(normalizedSearchTerm) ||
      item.description?.toLowerCase().includes(normalizedSearchTerm)
    );
  });

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
                className={styles.locationSelect}
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

      {selectedLocationId && (
        <section className={styles.receiptSection} aria-labelledby="receipt-heading">
          <div className={styles.receiptHeader}>
            <div>
              <h2 id="receipt-heading">Purchase Order Receipts</h2>
              <p>Record the total quantity received so far for items on active purchase orders.</p>
            </div>
          </div>

          {loading ? (
            <p className={styles.receiptStatus}>Checking active purchase orders...</p>
          ) : receiptRows.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={`${styles.itemsTable} ${styles.receiptTable}`}>
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Material Code</th>
                    <th>Item</th>
                    <th>Ordered</th>
                    <th>Received to Date</th>
                    <th>Remaining</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptRows.map(({ key, purchaseOrder, item }) => {
                    const itemId = item._id!;
                    const orderedQty = Number(item.newQty || 0);
                    const receivedQty = Number(item.receivedqtyNew || 0);
                    const remainingQty = Math.max(0, orderedQty - receivedQty);
                    const inputValue = receivedQtyInputs[itemId] ?? String(receivedQty);

                    return (
                      <tr key={key}>
                        <td className={styles.poNumber}>{purchaseOrder.PONumber || '-'}</td>
                        <td>{purchaseOrder.supplier || '-'}</td>
                        <td className={styles.mcode}>{item.mcode || '-'}</td>
                        <td className={styles.desc}>{item.description || '-'}</td>
                        <td className={styles.receiptQty}>{orderedQty}</td>
                        <td>
                          <input
                            className={styles.receivedQtyInput}
                            type="number"
                            min="0"
                            max={orderedQty}
                            step="any"
                            aria-label={`Received quantity for ${item.description || item.mcode}`}
                            value={inputValue}
                            onChange={(event) =>
                              setReceivedQtyInputs((currentInputs) => ({
                                ...currentInputs,
                                [itemId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className={styles.receiptQty}>{remainingQty}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.saveReceiptBtn}
                            onClick={() =>
                              handleUpdateReceivedQty(itemId, receivedQty, orderedQty)
                            }
                            disabled={savingReceiptItemId === itemId}
                            title="Update received quantity"
                          >
                            <FaCheck /> {savingReceiptItemId === itemId ? 'Saving' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.receiptStatus}>No active purchase orders with items were found for this location.</p>
          )}
        </section>
      )}

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
                <th>Type</th>
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
                    <td>{item.type || '-'}</td>
                    <td className={styles.desc}>{item.description}</td>
                    <td className={styles.gst}>{item.gst}%</td>
                    <td className={styles.unit}>{item.unit}</td>
                    <td className={styles.rate}>
                      {Number(item.rate).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={styles.qty}>
                      {Number(item.qty || 0)}
                    </td>
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
                  <td colSpan={9} className={styles.emptyCell}>
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
                <label>Item Type *</label>
                <select
                  required
                  value={itemForm.type}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, type: e.target.value as ItemType | '' })
                  }
                >
                  <option value="">Select item type</option>
                  <option value="PRIMARY">Primary</option>
                  <option value="SECONDARY">Secondary</option>
                </select>
              </div>

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
