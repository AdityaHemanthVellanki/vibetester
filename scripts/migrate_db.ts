import { migrate } from '@/lib/db'

async function main() {
  migrate()
  process.stdout.write('migrated\n')
}

main()