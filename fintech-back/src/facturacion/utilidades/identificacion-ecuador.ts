/**
 * Valida el dígito verificador de una cédula ecuatoriana.
 * Se admite el código provincial 30 para ecuatorianos registrados fuera del
 * país, además de las provincias 01 a 24.
 */
export function esCedulaEcuadorValida(identificacion: string): boolean {
  if (!/^\d{10}$/.test(identificacion)) {
    return false;
  }

  const provincia = Number(identificacion.slice(0, 2));
  const tercerDigito = Number(identificacion[2]);

  if (
    !((provincia >= 1 && provincia <= 24) || provincia === 30) ||
    tercerDigito > 5
  ) {
    return false;
  }

  const suma = identificacion
    .slice(0, 9)
    .split('')
    .reduce((acumulado, digito, indice) => {
      let producto = Number(digito) * (indice % 2 === 0 ? 2 : 1);

      if (producto > 9) {
        producto -= 9;
      }

      return acumulado + producto;
    }, 0);
  const verificador = (10 - (suma % 10)) % 10;

  return verificador === Number(identificacion[9]);
}

/**
 * Valida RUC de persona natural, sociedad privada o entidad pública. Además
 * del módulo 10/11 se comprueba el sufijo de establecimiento correspondiente.
 */
export function esRucEcuadorValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) {
    return false;
  }

  const tercerDigito = Number(ruc[2]);

  if (tercerDigito <= 5) {
    return esCedulaEcuadorValida(ruc.slice(0, 10)) && ruc.endsWith('001');
  }

  if (tercerDigito === 6) {
    return (
      validarModuloOnce(ruc.slice(0, 8), ruc[8], [3, 2, 7, 6, 5, 4, 3, 2]) &&
      ruc.slice(9) === '0001'
    );
  }

  if (tercerDigito === 9) {
    return (
      validarModuloOnce(ruc.slice(0, 9), ruc[9], [4, 3, 2, 7, 6, 5, 4, 3, 2]) &&
      ruc.endsWith('001')
    );
  }

  return false;
}

function validarModuloOnce(
  cuerpo: string,
  digitoVerificador: string,
  coeficientes: number[],
): boolean {
  const suma = cuerpo
    .split('')
    .reduce(
      (acumulado, digito, indice) =>
        acumulado + Number(digito) * coeficientes[indice],
      0,
    );
  const residuo = suma % 11;
  const resultado = 11 - residuo;

  // En módulo 11, once se representa como cero y diez no es un dígito
  // verificador admisible para estos tipos de RUC.
  if (resultado === 10) {
    return false;
  }

  const verificador = resultado === 11 ? 0 : resultado;

  return verificador === Number(digitoVerificador);
}
