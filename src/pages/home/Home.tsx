import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import styles from './Home.module.scss';
import { signInWithGoogle, signOutGoogle } from '../../firebase.ts';

const Home = () => {
    const navigate = useNavigate();
    const [loggedIn, setLoggedIn] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    const setLoginState = (email: string, role: string, userId: string) => {
        localStorage.setItem('hbus_user_logged_in', 'true');
        localStorage.setItem('hbus_user_email', email);
        localStorage.setItem('hbus_user_role', role);
        localStorage.setItem('hbus_user_id', userId);
        setLoggedIn(true);
        setUserRole(role);
    };

    const clearLoginState = () => {
        localStorage.removeItem('hbus_user_logged_in');
        localStorage.removeItem('hbus_user_email');
        localStorage.removeItem('hbus_user_role');
        localStorage.removeItem('hbus_user_id');
        setLoggedIn(false);
        setUserRole(null);
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
                    setLoginState(email, role, userId);
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
                            {(userRole === 'A' || userRole === 'B') && (
                                <button onClick={() => navigate('/purchase')}>PURCHASE ORDER</button>
                            )}
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