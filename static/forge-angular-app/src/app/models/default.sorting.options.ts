export interface SortOption {
  sortBy: string;
  sortOrder: string;
  label: string;
}

export const DefaultSortingOptions: SortOption[] = [
  {
    sortBy: 'USER_SORT',
    sortOrder: 'ASC',
    label: 'User Sorted',
  },
  {
    sortBy: 'NAME',
    sortOrder: 'ASC',
    label: 'Name A to Z',
  },
  {
    sortBy: 'NAME',
    sortOrder: 'DESC',
    label: 'Name Z to A',
  },
  {
    sortBy: 'PRIORITY',
    sortOrder: 'ASC',
    label: 'Priority Low to High',
  },
  {
    sortBy: 'PRIORITY',
    sortOrder: 'DESC',
    label: 'Priority High to Low',
  },
  {
    sortBy: 'CREATED_AT',
    sortOrder: 'DESC',
    label: 'Created',
  },
  {
    sortBy: 'UPDATED_AT',
    sortOrder: 'DESC',
    label: 'Updated',
  },
];
