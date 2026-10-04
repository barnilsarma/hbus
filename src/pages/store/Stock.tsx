import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import styles from './Stock.module.scss';

type Location = {
  _id: string;
  name: string;
};

type RawMaterial = {
  _id: string;
  mcode: string;
  name: string;
  ordered: number;
  stock: number;
  location?: Location | string;
};

type Product = {
  _id: string;
  name: string;
  ready: number;
  repairing: number;
  defective: number;
  location?: Location | string;
  rawMaterials?: Array<Pick<RawMaterial, '_id' | 'mcode' | 'name'> | string>;
};

const getResponseData = (response: unknown): unknown => {
  if (!response || typeof response !== 'object' || !('data' in response)) return response;
  const data = (response as { data: unknown }).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const envelope = data as Record<string, unknown>;
  return envelope.data ?? envelope.rawMaterials ?? envelope.primaries ?? envelope.locations ?? data;
};

const getLocationName = (location: Location | string | undefined, fallback: string) => {
  if (location && typeof location === 'object') return location.name || fallback;
  return fallback;
};

export default function Stock() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isAdmin] = useState(() => {
    const storedUser = localStorage.getItem('user');
    let user: { type?: string; role?: string } | null = null;
    if (storedUser) {
      try {
        user = JSON.parse(storedUser) as { type?: string; role?: string };
      } catch (error) {
        console.error('Error reading stored user:', error);
      }
    }
    return (
      localStorage.getItem('hbus_user_role') ||
      localStorage.getItem('user_type') ||
      user?.type ||
      user?.role ||
      ''
    ).trim().toUpperCase() === 'A';
  });
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    const storedLocationId = localStorage.getItem('hbus_selected_location_id') || '';
    return isAdmin || storedLocationId === 'ALL' ? '' : storedLocationId;
  });
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const savedLocationId = localStorage.getItem('hbus_selected_location_id') || '';
    axios.get(`${import.meta.env.VITE_APP_API}/api/location`)
      .then((response) => {
        const result = getResponseData(response);
        const available = Array.isArray(result) ? result as Location[] : [];
        setLocations(available);
        const selected = available.some((location) => location._id === savedLocationId)
          ? savedLocationId
          : available[0]?._id || '';
        setSelectedLocationId(selected);
        if (selected) localStorage.setItem('hbus_selected_location_id', selected);
      })
      .catch((error) => {
        console.error('Error fetching locations:', error);
        toast.error('Failed to load locations.');
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedLocationId) return;

    let cancelled = false;
    const loadStock = async () => {
      setLoading(true);
      try {
        const [rawResponse, productResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_APP_API}/api/rawmaterials/location/${selectedLocationId}`),
          axios.get(`${import.meta.env.VITE_APP_API}/api/primary/location/${selectedLocationId}`),
        ]);
        const rawResult = getResponseData(rawResponse);
        const productResult = getResponseData(productResponse);
        if (!cancelled) {
          setRawMaterials(Array.isArray(rawResult) ? rawResult as RawMaterial[] : []);
          setProducts(Array.isArray(productResult) ? productResult as Product[] : []);
        }
      } catch (error) {
        console.error('Error loading stock records:', error);
        toast.error('Failed to load stock records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStock();
    return () => {
      cancelled = true;
    };
  }, [selectedLocationId]);

  const changeLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    localStorage.setItem('hbus_selected_location_id', locationId);
    setLoading(Boolean(locationId));
    setRawMaterials([]);
    setProducts([]);
  };

  return (
    <main className={styles.stockPage}>
      <header className={styles.header}>
        <div>
          <h1>Stock</h1>
          <p>Raw materials and finished product inventory.</p>
        </div>
        <div className={styles.headerActions}>
          {isAdmin && (
            <label className={styles.locationField}>
              Location
              <select value={selectedLocationId} onChange={(event) => changeLocation(event.target.value)}>
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>{location.name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => navigate('/store')}>Back to Store</button>
        </div>
      </header>

      {!selectedLocationId && <p className={styles.status}>Select a location to view stock records.</p>}
      {loading && <p className={styles.status}>Loading stock records...</p>}

      <section className={styles.tableSection}>
        <h2>Raw Materials</h2>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Name</th>
                <th>Ordered</th>
                <th>Stock</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rawMaterials.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No RawMaterial records found.</td></tr>
              ) : rawMaterials.map((material) => (
                <tr key={material._id}>
                  <td>{material.mcode}</td>
                  <td>{material.name}</td>
                  <td>{material.ordered}</td>
                  <td>{material.stock}</td>
                  <td>{getLocationName(material.location, locations.find((loc) => loc._id === selectedLocationId)?.name || selectedLocationId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.tableSection}>
        <h2>Products</h2>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ready</th>
                <th>Repairing</th>
                <th>Defective</th>
                <th>Raw Materials</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {!loading && products.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No Primary product records found.</td></tr>
              ) : products.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td>{product.ready}</td>
                  <td>{product.repairing}</td>
                  <td>{product.defective}</td>
                  <td>
                    {product.rawMaterials?.length
                      ? product.rawMaterials.map((material) =>
                        typeof material === 'string' ? material : material.mcode || material.name || material._id,
                      ).join(', ')
                      : '-'}
                  </td>
                  <td>{getLocationName(product.location, locations.find((loc) => loc._id === selectedLocationId)?.name || selectedLocationId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
