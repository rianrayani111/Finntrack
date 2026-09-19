// Where each account type lives. Families and schools are separate products:
// a signed-in user is only ever sent to their own role's home.
const HOME_BY_ROLE = {
  parent: '/parent',
  child: '/dashboard',
  student: '/student',
  educator: '/educator',
};

export const homePathForRole = (role) => HOME_BY_ROLE[role] || '/login';
