import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface DropsPaginationProps {
  currentPage: number;
  totalPages: number;
  totalDrops: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function DropsPagination({
  currentPage,
  totalPages,
  totalDrops,
  onPageChange,
  isLoading = false,
}: DropsPaginationProps) {
  if (totalPages <= 1) return null;

  const perPage = 50;
  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalDrops);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5; // Max pages to show at once
    
    if (totalPages <= showPages + 2) {
      // Show all pages if not too many
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(currentPage - 1)}
              className={currentPage === 1 || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>

          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={page === currentPage}
                  className={isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(currentPage + 1)}
              className={currentPage === totalPages || isLoading ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {totalDrops} drops
      </p>
    </div>
  );
}
