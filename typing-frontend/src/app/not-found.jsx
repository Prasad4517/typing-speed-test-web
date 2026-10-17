import { Button, Container, EmptyState } from '@/common-components';

export default function NotFound() {
  return (
    <div className="page-shell">
      <Container size="sm">
        <EmptyState
          action={<Button href="/">Return home</Button>}
          description="The page you requested does not exist."
          title="Page not found"
        />
      </Container>
    </div>
  );
}
