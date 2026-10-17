import { Container, Skeleton, Stack } from '@/common-components';

export default function Loading() {
  return (
    <div className="page-shell">
      <Container size="md">
        <Stack gap="lg">
          <Skeleton height="80px" width="55%" />
          <Skeleton height="280px" />
          <Skeleton height="42px" width="35%" />
        </Stack>
      </Container>
    </div>
  );
}
