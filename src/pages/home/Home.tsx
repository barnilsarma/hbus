import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Home.module.scss';
import { signInWithGoogle, signOutGoogle } from '../../firebase.ts';

const stockResources = [
    { label: 'LIVE STOCK', resource: 'livestocks' },
    { label: 'ORDER ENTRY', resource: 'order-entries' },
    { label: 'INVOICE', resource: 'invoices' },
    { label: 'INVOICE PO', resource: 'invoice-pos' },
    { label: 'REJECTION STOCK', resource: 'rejection-stocks' },
    { label: 'REJECTION ENTRY', resource: 'rejection-entries' },
    { label: 'DAILY PRODUCTION REPORT STOCK', resource: 'daily-prod-report-stocks' },
    { label: 'DAILY PRODUCTION', resource: 'daily-prods' },
    { label: 'PER JOB DATA', resource: 'per-job-data' },
    { label: 'STOCK ADJUSTMENT ENTRY', resource: 'stock-adjustment-entries' },
    { label: 'PRODUCTION FLOOR', resource: 'production-flor' },
    { label: 'REPAIRING DATA', resource: 'repairing-data' },
    { label: 'REPAIRING DATA RETURN STOCK', resource: 'repairing-data-return-stocks' },
    { label: 'REPAIRING DATA REPAIRING STOCK', resource: 'repairing-data-repairing-stocks' },
];

const Home = () => {
    const navigate = useNavigate();
    const [loggedIn, setLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [viewaccess, setViewAccess] = useState<string[]>([]);
    const [editaccess, setEditAccess] = useState<string[]>([]);

    const setLoginState = (email: string, role: string, userId: string, viewAccess: string[] = [], editAccess: string[] = []) => {
        localStorage.setItem('hbus_user_logged_in', 'true');
        localStorage.setItem('hbus_user_email', email);
        localStorage.setItem('hbus_user_role', role);
        localStorage.setItem('hbus_user_id', userId);
        localStorage.setItem('hbus_user_viewaccess', JSON.stringify(viewAccess));
        localStorage.setItem('hbus_user_editaccess', JSON.stringify(editAccess));
        setLoggedIn(true);
        setUserRole(role);
        setViewAccess(viewAccess);
        setEditAccess(editAccess);
    };

    const clearLoginState = () => {
        localStorage.removeItem('hbus_user_logged_in');
        localStorage.removeItem('hbus_user_email');
        localStorage.removeItem('hbus_user_role');
        localStorage.removeItem('hbus_user_id');
        localStorage.removeItem('hbus_user_viewaccess');
        localStorage.removeItem('hbus_user_editaccess');
        setLoggedIn(false);
        setUserRole(null);
        setViewAccess([]);
        setEditAccess([]);
    };

    useEffect(() => {
        const storedLoggedIn = localStorage.getItem('hbus_user_logged_in') === 'true';
        const storedRole = localStorage.getItem('hbus_user_role');
        const storedUserId = localStorage.getItem('hbus_user_id');
        setLoggedIn(storedLoggedIn);
        setUserRole(storedRole);

        if (!storedLoggedIn || !storedUserId) {
            return;
        }

        let isCurrent = true;

        (async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users/${storedUserId}`);
                if (!isCurrent) {
                    return;
                }

                const role = response.data?.role ?? storedRole;
                const viewaccess = response.data?.viewaccess ?? [];
                const editaccess = response.data?.editaccess ?? [];
                console.log(viewaccess);
                console.log(editaccess);
                setViewAccess(viewaccess);
                setEditAccess(editaccess);
                localStorage.setItem('hbus_user_viewaccess', JSON.stringify(viewaccess));
                localStorage.setItem('hbus_user_editaccess', JSON.stringify(editaccess));
                setLoggedIn(true);
                setUserRole(role);
                localStorage.setItem('hbus_user_role', role);
            } catch (error) {
                console.error('Failed to refresh user role:', error);
                if (isCurrent) {
                    clearLoginState();
                }
            }
        })();

        return () => {
            isCurrent = false;
        };
    }, []);

    const handleGoogleSignIn = async () => {
        try {
            await toast.promise(
                (async () => {
                    const result = await signInWithGoogle();
                    const email = result?.user?.email;
                    if (!email) {
                        throw new Error('Google sign-in did not return an email.');
                    }

                    const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/users`);
                    const users = response.data;
                    const existingUser = Array.isArray(users)
                        ? users.some((user) => user?.email === email)
                        : false;

                    if (!existingUser) {
                        navigate('/register', {
                            state: {
                                email,
                                displayName: result.user.displayName ?? '',
                            },
                        });
                        return;
                    }

                    const userRecord = Array.isArray(users)
                        ? users.find((user) => user?.email === email)
                        : null;

                    const role = userRecord?.role ?? 'D';
                    const userId = userRecord?.userId ?? userRecord?._id ?? '';
                    setLoginState(email, role, userId, userRecord?.viewaccess ?? [], userRecord?.editaccess ?? []);
                })(),
                {
                    loading: 'Signing in with Google...',
                    success: 'Signed in successfully.',
                    error: 'Google sign-in failed.',
                },
            );
        } catch {
            // Error shown via toast.promise.
        }
    };

    const handleLogout = async () => {
        try {
            await toast.promise(
                (async () => {
                    await signOutGoogle();
                    clearLoginState();
                })(),
                {
                    loading: 'Signing out...',
                    success: 'Signed out successfully.',
                    error: 'Logout failed.',
                },
            );
        } catch {
            // Error shown via toast.promise.
        }
    };

    return (
        <main>
            <div className={styles.home}>
                <div className={styles.navbar}>
                    {loggedIn ? (
                        <>
                            {((userRole === 'A' || userRole === 'B') || (viewaccess.findIndex((item) => item === 'Purchase') !== -1 || editaccess.findIndex((item) => item === 'Purchase') !== -1)) && (
                                <button onClick={() => navigate('/purchase')}>PURCHASE ORDER</button>
                            )}
                            {(userRole === 'A' || userRole === 'B') && (
                                <button onClick={() => navigate('/location')}>LOCATIONS</button>
                            )}
                            {(userRole === 'A' || userRole === 'B') && (
                                <button onClick={() => navigate('/booking')}>BOOKINGS</button>
                            )}
                            {((userRole === 'A' || userRole === 'B') || (viewaccess.findIndex((item) => item === 'Store') !== -1 || editaccess.findIndex((item) => item === 'Store') !== -1)) && (
                                <button onClick={() => navigate('/store')}>STORE</button>
                            )}
                            {((userRole === 'A' || userRole === 'B') || (viewaccess.some((item) => item.trim().toLowerCase() === 'stock') || editaccess.some((item) => item.trim().toLowerCase() === 'stock'))) && stockResources.map(({ label, resource }) => (
                                <button key={resource} onClick={() => navigate(`/stock/${resource}`)}>{label}</button>
                            ))}
                            {userRole === 'A' && (
                                <button onClick={() => navigate('/users')}>USERS</button>
                            )}
                            <button onClick={handleLogout}>LOGOUT</button>
                        </>
                    ) : (
                        <button onClick={handleGoogleSignIn}>SIGN IN WITH GOOGLE</button>
                    )}
                </div>
            </div>
        </main>
    );
};

export default Home;