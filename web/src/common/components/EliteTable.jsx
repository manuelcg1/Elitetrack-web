import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

export const EliteTablePrimaryText = ({ children, ...props }) => (
  <Typography
    variant="body2"
    {...props}
    sx={{ fontSize: 14, fontWeight: 500, color: 'text.primary', ...props.sx }}
  >
    {children}
  </Typography>
);

export const EliteTableSecondaryText = ({ children, ...props }) => (
  <Typography
    variant="caption"
    {...props}
    sx={{ fontSize: 12, color: 'text.secondary', ...props.sx }}
  >
    {children}
  </Typography>
);

export const EliteTableAvatar = ({ children, ...props }) => (
  <Avatar
    {...props}
    sx={(theme) => ({
      width: 36,
      height: 36,
      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
      color: 'primary.main',
      fontSize: 14,
      fontWeight: 600,
      ...props.sx,
    })}
  >
    {children}
  </Avatar>
);

export const EliteTableStatusChip = ({ label, color = 'default' }) => (
  <Chip
    size="small"
    label={label}
    color={color}
    variant="outlined"
    sx={(theme) => {
      const statusColor = color === 'default' ? theme.palette.grey[500] : theme.palette[color].main;
      return {
        height: 24,
        bgcolor: alpha(statusColor, theme.palette.mode === 'dark' ? 0.16 : 0.1),
        borderColor: alpha(statusColor, 0.24),
        color: statusColor,
        fontSize: 12,
        fontWeight: 600,
        transition: 'color 150ms ease-in-out, background-color 150ms ease-in-out',
        '& .MuiChip-label': { px: 1 },
      };
    }}
  />
);

export const EliteTableActionButton = ({ label, color = 'primary', children, ...props }) => (
  <Tooltip title={label}>
    <span>
      <IconButton
        size="small"
        aria-label={label}
        {...props}
        sx={(theme) => {
          const actionColor = theme.palette[color]?.main || theme.palette.text.secondary;
          return {
            width: 36,
            height: 36,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '10px',
            color: actionColor,
            transition: 'color 150ms ease-in-out, background-color 150ms ease-in-out',
            '&:hover': { bgcolor: alpha(actionColor, 0.08) },
            '&:focus-visible': {
              outline: `2px solid ${actionColor}`,
              outlineOffset: 2,
            },
            '&.Mui-disabled': { color: 'action.disabled' },
            '& .MuiSvgIcon-root': { fontSize: 20 },
          };
        }}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

const compareValues = (first, second) => {
  if (first == null && second == null) return 0;
  if (first == null) return 1;
  if (second == null) return -1;
  if (typeof first === 'number' && typeof second === 'number') return first - second;
  return String(first).localeCompare(String(second), 'es', { sensitivity: 'base' });
};

const EliteTable = ({
  columns,
  rows,
  getRowId = (row) => row.id,
  initialSort,
  rowsPerPageOptions = [10, 25, 50],
  height = 560,
  minWidth = 720,
  loading = false,
  emptyState,
  ariaLabel = 'Tabla de datos',
}) => {
  const [sortBy, setSortBy] = useState(initialSort?.id || null);
  const [sortDirection, setSortDirection] = useState(initialSort?.direction || 'asc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return rows;
    const column = columns.find((item) => item.id === sortBy);
    const getValue = column?.sortValue || ((row) => row[sortBy]);
    return [...rows].sort((first, second) => {
      const result = compareValues(getValue(first), getValue(second));
      return sortDirection === 'asc' ? result : -result;
    });
  }, [columns, rows, sortBy, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const visibleRows = sortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const firstVisible = sortedRows.length ? (page - 1) * rowsPerPage + 1 : 0;
  const lastVisible = Math.min(page * rowsPerPage, sortedRows.length);

  const handleSort = (column) => {
    if (!column.sortable) return;
    if (sortBy === column.id) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column.id);
      setSortDirection('asc');
    }
    setPage(1);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '16px',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          `0 8px 28px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.18 : 0.05)}`,
      }}
    >
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto', border: 0, borderRadius: 0 }}>
        <Table
          stickyHeader
          aria-label={ariaLabel}
          sx={{
            minWidth,
            '& .MuiTableCell-root': {
              px: 2,
              py: 1.5,
              fontSize: 14,
              fontWeight: 500,
              color: 'text.primary',
              borderBottomColor: (theme) => alpha(theme.palette.divider, 0.65),
            },
            '& .MuiTableCell-head': {
              height: 56,
              py: 0,
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.2px',
              textTransform: 'none',
              borderBottom: '1px solid',
              borderBottomColor: 'divider',
              boxShadow: 'none',
            },
            '& .MuiTableRow-root': {
              height: 52,
              transition: 'background-color 150ms ease-in-out',
            },
            '& .MuiTableRow-hover:hover': { bgcolor: 'action.hover' },
          }}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={{
                    minWidth: column.minWidth,
                    whiteSpace: 'nowrap',
                    display: column.hideOnMobile ? { xs: 'none', sm: 'table-cell' } : undefined,
                  }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(column)}
                      hideSortIcon
                      sx={{
                        '& .MuiTableSortLabel-icon': { fontSize: 16 },
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: 3,
                          borderRadius: 0.5,
                        },
                      }}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading &&
              [...Array(rowsPerPage)].map((_, rowIndex) => (
                <TableRow key={`loading-${rowIndex}`}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      sx={{
                        display: column.hideOnMobile ? { xs: 'none', sm: 'table-cell' } : undefined,
                      }}
                    >
                      <Skeleton animation="wave" height={24} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading &&
              visibleRows.map((row) => (
                <TableRow key={getRowId(row)} hover>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      sx={{
                        display: column.hideOnMobile ? { xs: 'none', sm: 'table-cell' } : undefined,
                      }}
                    >
                      {column.render ? column.render(row) : row[column.id]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && !visibleRows.length && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                  <Box
                    sx={{
                      minHeight: 300,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      textAlign: 'center',
                    }}
                  >
                    {emptyState?.icon || (
                      <InboxOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                    )}
                    <EliteTablePrimaryText sx={{ fontWeight: 600 }}>
                      {emptyState?.title || 'No hay registros'}
                    </EliteTablePrimaryText>
                    <EliteTableSecondaryText>
                      {emptyState?.description || 'No se encontraron datos para mostrar.'}
                    </EliteTableSecondaryText>
                    {emptyState?.action && (
                      <Button
                        size="small"
                        startIcon={emptyState.action.icon}
                        onClick={emptyState.action.onClick}
                        sx={{ mt: 1 }}
                      >
                        {emptyState.action.label}
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          minHeight: 64,
          px: { xs: 2, md: 3 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          Mostrando {firstVisible}-{lastVisible} de {sortedRows.length} registros
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: 13, whiteSpace: 'nowrap' }}
          >
            Filas por página
          </Typography>
          <Select
            size="small"
            value={rowsPerPage}
            inputProps={{ 'aria-label': 'Filas por página' }}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 72, fontSize: 13 }}
          >
            {rowsPerPageOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            shape="rounded"
            siblingCount={0}
            showFirstButton
            showLastButton
            sx={{ '& .MuiPaginationItem-root': { fontSize: 13 } }}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default EliteTable;
