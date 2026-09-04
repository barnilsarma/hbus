import axios from "axios";
import React, { useEffect, useState, useMemo } from "react";
import styles from "./Location.module.scss";

interface IUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  location?: string | { _id: string; name: string };
}

interface ILocationItem {
  _id?: string;
  id?: string;
  name: string;
  address?: string;
  description?: string;
  users?: IUser[] | string[];
}

interface LocationApiResponse {
  success: boolean;
  count: number;
  data: ILocationItem[];
}

const Location: React.FC = () => {
  const [locationResponse, setLocationResponse] = useState<LocationApiResponse | null>(null);
  const [locForm, setLocForm] = useState<boolean>(false);

  // New Location Form States
  const [name, setName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // User Management Modal States
  const [users, setUsers] = useState<IUser[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ILocationItem | null>(null);
  
  // State for viewing users assigned to a location
  const [viewingLocation, setViewingLocation] = useState<ILocationItem | null>(null);

  const [userSearchTerm, setUserSearchTerm] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assigningUsers, setAssigningUsers] = useState<boolean>(false);

  const userRole = localStorage.getItem("hbus_user_role");
  const isAuthorizedToManageUsers = userRole === "A" || userRole === "B";

  const fetchLocationData = async () => {
    try {
      const res = await axios.get<LocationApiResponse>(
        `${import.meta.env.VITE_APP_API}/api/location`
      );
      setLocationResponse(res.data);
    } catch (error) {
      console.error("Failed to fetch location data:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
      // Controller returns array directly: res.json(users)
      setUsers(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchLocationData();
    fetchUsers();
  }, []);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setErrorMsg("Please fill out both name and address fields.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      await axios.post(`${import.meta.env.VITE_APP_API}/api/location`, {
        name,
        address,
      });

      setName("");
      setAddress("");
      setLocForm(false);
      await fetchLocationData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to create location");
    } finally {
      setLoading(false);
    }
  };

  // Open Add Users Popup Modal
  const handleOpenAddUsersModal = (location: ILocationItem) => {
    setSelectedLocation(location);
    setUserSearchTerm("");
    setSelectedUserIds([]);
    setErrorMsg("");
    fetchUsers(); // Refresh users list
  };

  // Regex Search Filtering
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return users;

    try {
      const regex = new RegExp(userSearchTerm.trim(), "i");
      return users.filter((u) => regex.test(u.name) || regex.test(u.email));
    } catch {
      // Fallback if regex string is invalid while typing
      const term = userSearchTerm.toLowerCase();
      return users.filter(
        (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      );
    }
  }, [users, userSearchTerm]);

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmAddUsers = async () => {
    const locId = selectedLocation?._id || selectedLocation?.id;
    if (!locId || selectedUserIds.length === 0) return;

    try {
      setAssigningUsers(true);
      setErrorMsg("");

      // Execute endpoint requests for all selected users
      await Promise.all(
        selectedUserIds.map((userId) =>
          axios.post(
            `${import.meta.env.VITE_APP_API}/api/location/${locId}/users/${userId}`
          )
        )
      );

      setSelectedLocation(null);
      setSelectedUserIds([]);
      await fetchLocationData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to add users to location");
    } finally {
      setAssigningUsers(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Locations</h1>
        {userRole === "A" && !locForm && (
          <button className={styles.primaryBtn} onClick={() => setLocForm(true)}>
            Add New Location
          </button>
        )}
      </header>

      {/* New Location Form */}
      {locForm && (
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Create New Location</h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => {
                setLocForm(false);
                setErrorMsg("");
              }}
            >
              &times;
            </button>
          </div>

          {errorMsg && <p className={styles.errorAlert}>{errorMsg}</p>}

          <form onSubmit={handleCreateLocation} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="loc-name">Location Name</label>
              <input
                id="loc-name"
                type="text"
                placeholder="e.g. Headquarters"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="loc-address">Address</label>
              <input
                id="loc-address"
                type="text"
                placeholder="e.g. 123 Tech Blvd"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setLocForm(false);
                  setErrorMsg("");
                }}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? "Submitting..." : "Save Location"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Location Grid */}
      <main className={styles.grid}>
        {locationResponse ? (
          locationResponse.data.length > 0 ? (
            locationResponse.data.map((loc) => (
              <div key={loc._id || loc.id} className={styles.card}>
                <div>
                  <h2 className={styles.cardTitle}>{loc.name}</h2>
                  <p className={styles.cardBody}>{loc.address || loc.description}</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {loc.users && (
                    <span className={styles.badge}>
                      {loc.users.length} Users Assigned
                    </span>
                  )}
                  {/* Show Users Button */}
                  {loc.users && loc.users.length > 0 && (
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => setViewingLocation(loc)}
                    >
                      Show Users
                    </button>
                  )}
                  {isAuthorizedToManageUsers && (
                    <button
                      className={styles.editBtn}
                      onClick={() => handleOpenAddUsersModal(loc)}
                    >
                      Add Users
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No locations found.</p>
          )
        ) : (
          <p className={styles.loadingState}>Loading location data...</p>
        )}
      </main>

      {/* View Users Modal */}
      {viewingLocation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.formHeader}>
              <h2>Users in {viewingLocation.name}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setViewingLocation(null)}
              >
                &times;
              </button>
            </div>

            <div className={styles.userList}>
              {viewingLocation.users && viewingLocation.users.length > 0 ? (
                viewingLocation.users.map((user, idx) => {
                  // Fallback to handle both populated IUser objects and string IDs
                  const isPopulated = typeof user !== "string";
                  const userId = isPopulated ? (user as IUser)._id : user;
                  const userName = isPopulated ? (user as IUser).name : `User ID: ${user}`;
                  const userEmail = isPopulated ? (user as IUser).email : "";
                  const userRole = isPopulated ? (user as IUser).role : "";

                  return (
                    <div key={userId || idx} className={styles.userItem}>
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{userName}</span>
                        {userEmail && <span className={styles.userEmail}>{userEmail}</span>}
                      </div>
                      {userRole && <span className={styles.userRoleTag}>Role {userRole}</span>}
                    </div>
                  );
                })
              ) : (
                <p className={styles.emptyState}>No users assigned to this location.</p>
              )}
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setViewingLocation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Users Modal */}
      {selectedLocation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.formHeader}>
              <h2>Add Users to {selectedLocation.name}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedLocation(null)}
              >
                &times;
              </button>
            </div>

            {errorMsg && <p className={styles.errorAlert}>{errorMsg}</p>}

            <div className={styles.formGroup}>
              <label htmlFor="user-search">Search Registered User (Name / Email)</label>
              <input
                id="user-search"
                type="text"
                placeholder="Type regex or plain search..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.userList}>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <label key={user._id} className={styles.userItem}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user._id)}
                      onChange={() => handleToggleUserSelection(user._id)}
                    />
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{user.name}</span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </div>
                    <span className={styles.userRoleTag}>Role {user.role}</span>
                  </label>
                ))
              ) : (
                <p className={styles.emptyState}>No matching users found.</p>
              )}
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setSelectedLocation(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={assigningUsers || selectedUserIds.length === 0}
                onClick={handleConfirmAddUsers}
              >
                {assigningUsers
                  ? "Adding..."
                  : `Confirm Add (${selectedUserIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Location;