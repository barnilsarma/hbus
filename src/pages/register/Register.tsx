import axios from 'axios';
import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Register.module.scss';

interface LocationState {
  email?: string | null;
  displayName?: string | null;
}

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const defaultEmail = state?.email ?? '';
  const defaultName = state?.displayName ?? '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name')?.toString() ?? '';
    const email = formData.get('email')?.toString() ?? '';

    try {
      const response = await axios.post(`${import.meta.env.VITE_APP_API}/api/users`, { name, email });

      if (response.status >= 200 && response.status < 300) {
        navigate('/');
      } else {
        console.error('Register failed:', response.statusText);
      }
    } catch (error) {
      console.error('Register submit error:', error);
    }
  };

  return (
    <main className={styles.register}>
      <section className={styles.card}>
        <div className={styles.header}>
          <h1>Register</h1>
          <p>Complete your registration to continue.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={defaultName}
              placeholder="Jane Doe"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultEmail}
              placeholder="you@example.com"
              required
            />
          </div>

          <button className={styles.submitButton} type="submit">
            Create account
          </button>
        </form>
      </section>
    </main>
  );
};

export default Register;
