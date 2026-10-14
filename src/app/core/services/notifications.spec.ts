import { updatesForUser } from './notifications';
import { PoolUpdate } from '../../models/pool-update';

function update(id: string, grades: number[]): PoolUpdate {
  return { id, level: 'ilkokul', grades, categoryId: id, subject: 'Matematik', topic: 'T', count: 3, createdAt: 1 };
}

describe('updatesForUser', () => {
  const list = [update('g3', [3]), update('g4', [4]), update('all', [])];

  it('keeps only the student’s sınıf and level-wide updates', () => {
    expect(updatesForUser(list, { grade: 3 }).map((u) => u.id)).toEqual(['g3', 'all']);
  });

  it('shows the whole level when the sınıf is unknown', () => {
    expect(updatesForUser(list, { grade: null }).length).toBe(3);
  });
});
