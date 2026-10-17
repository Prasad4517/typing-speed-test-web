'use client';

import { useState } from 'react';
import styles from './Accordion.module.scss';

/** @param {{ items: Array<{title:string,content:import('react').ReactNode}>, defaultOpen?: number }} props */
export function Accordion({ items, defaultOpen = -1 }) {
  const [openIndex, setOpenIndex] = useState(defaultOpen);
  return (
    <div className={styles.accordion}>
      {items.map((item, index) => {
        const open = openIndex === index;
        const id = `accordion-panel-${index}`;
        return (
          <div className={styles.item} key={item.title}>
            <h3>
              <button
                aria-controls={id}
                aria-expanded={open}
                className={styles.trigger}
                onClick={() => setOpenIndex(open ? -1 : index)}
                type="button"
              >
                <span>{item.title}</span>
                <span aria-hidden="true">{open ? '−' : '+'}</span>
              </button>
            </h3>
            <div className={styles.panel} hidden={!open} id={id}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
