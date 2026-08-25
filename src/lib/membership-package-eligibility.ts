import type { MembershipPackage, VehicleSegment } from "@/types";

export function membershipPackageMatchesVehicleSegment(
  pkg: Pick<MembershipPackage, "applicableVehicleSegments">,
  vehicleSegment: VehicleSegment | null | undefined
): boolean {
  const applicable = pkg.applicableVehicleSegments ?? [];
  if (applicable.length === 0) return true;
  if (!vehicleSegment) return true;
  return applicable.includes(vehicleSegment);
}

export function filterMembershipPackagesForVehicleSegment<T extends Pick<MembershipPackage, "applicableVehicleSegments">>(
  packages: T[],
  vehicleSegment: VehicleSegment | null | undefined
): T[] {
  return packages.filter((pkg) => membershipPackageMatchesVehicleSegment(pkg, vehicleSegment));
}