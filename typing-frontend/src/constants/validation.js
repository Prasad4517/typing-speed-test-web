export const VALIDATION = Object.freeze({
  certificateNameMaxLength: 80,
  certificateNamePattern: /^[\p{L}][\p{L}\s.'-]*$/u,
  certificateIdPattern: /^[A-Z0-9-]{8,32}$/i,
});
