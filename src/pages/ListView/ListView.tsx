import { useStore } from '@/hooks'
import { Button } from '@/components'
import styles from './ListView.module.css'

export function ListView() {
  const { copyItems, createItem, editItem } = useStore()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Copy Items</h2>
        <Button variant="primary" size="sm" icon="plus" onClick={createItem}>
          New
        </Button>
      </div>

      {copyItems.length === 0 ? (
        <div className={styles.empty}>
          <i className="ti ti-clipboard-list" />
          <p>No copy items yet</p>
          <p className={styles.hint}>Create your first copy item to get started</p>
        </div>
      ) : (
        <div className={styles.list}>
          {copyItems.map((item, index) => (
            <div
              key={item.id}
              className={styles.card}
              onClick={() => editItem(index)}
            >
              <div className={styles.cardInfo}>
                <div className={styles.cardName}>{item.name || 'Untitled'}</div>
                <div className={styles.cardMeta}>
                  {Object.keys(item.variables).length} variable
                  {Object.keys(item.variables).length !== 1 ? 's' : ''}
                </div>
              </div>
              <i className="ti ti-chevron-right" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

