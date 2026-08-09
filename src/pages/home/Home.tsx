import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import { signInWithGoogle, signOutGoogle } from '../../firebase.ts';

const Home = () => {
    const navigate = useNavigate();
    const [loggedIn, setLoggedIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const storedLoggedIn = localStorage.getItem('hbus_user_logged_in') === 'true';
        const storedEmail = localStorage.getItem('hbus_user_email');
        setLoggedIn(storedLoggedIn);
        setUserEmail(storedEmail);
    }, []);

    const setLoginState = (email: string) => {
        localStorage.setItem('hbus_user_logged_in', 'true');
        localStorage.setItem('hbus_user_email', email);
        setLoggedIn(true);
        setUserEmail(email);
    };

    const clearLoginState = () => {
        localStorage.removeItem('hbus_user_logged_in');
        localStorage.removeItem('hbus_user_email');
        setLoggedIn(false);
        setUserEmail(null);
    };

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithGoogle();
            const email = result?.user?.email;
            if (!email) {
                console.error('Google sign-in did not return an email.');
                return;
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

            setLoginState(email);
            console.log('User already exists:', email);
        } catch (error) {
            if (error instanceof Error) {
                console.error('Google sign-in failed:', error.message);
            } else {
                console.error('Google sign-in failed:', error);
            }
        }
    };

    const handleLogout = async () => {
        try {
            await signOutGoogle();
        } catch (error) {
            console.error('Logout failed:', error);
        }

        clearLoginState();
    };

    return (
        <main>
            <div className={styles.home}>
                <div className={styles.navbar}>
                    {loggedIn ? (
                        <button onClick={handleLogout}>LOGOUT</button>
                    ) : (
                        <button onClick={handleGoogleSignIn}>SIGN IN WITH GOOGLE</button>
                    )}
                </div>
            </div>
        </main>
    );
};

export default Home;