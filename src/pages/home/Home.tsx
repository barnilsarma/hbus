import styles from './Home.module.scss';
import { signInWithGoogle } from '../../firebase';

const Home = () => {
    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithGoogle();
            console.log('Google sign-in successful:', result.user);
        } catch (error) {
            if (error instanceof Error) {
                console.error('Google sign-in failed:', error.message);
            } else {
                console.error('Google sign-in failed:', error);
            }
        }
    };

    return (
        <main>
            <div className={styles.home}>
                <div className={styles.navbar}>
                    <button onClick={handleGoogleSignIn}>SIGN IN WITH GOOGLE</button>
                </div>
            </div>
        </main>
    );
};

export default Home;