'use client';

import Link from 'next/link';
import styles from './Navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        {/* Logo Section */}
        <Link href="/" className={styles.logoLink}>
         Logo
        </Link>

        {/* Navigation Links */}
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>
            Events
          </Link>
          <Link href="/sync-jobs" className={styles.navLink}>
            Sync Jobs
          </Link>
        </div>
      </div>
    </nav>
  );
}

