import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteOwned, requiresProjectDeleteApproval, canApproveProjectDeletion, canPublishAnnouncements, isManagement } from './permissions.js';
const base={id:'owner',areaId:'one',cargo:'Trabajador',rol:'Usuario',isSuperAdmin:false};
test('el creador puede gestionar el borrado, sin concederlo al técnico ni a Administración',()=>{
 for(const cargo of ['Trabajador','Asistente','Tecnico','Administracion']){
  const actor={...base,cargo,permisos:{eliminarProyectos:true,aprobar:true}};
  assert.equal(canDeleteOwned(actor,'owner','one'),true);
  assert.equal(canDeleteOwned(actor,'other','one'),false);
 }
});
test('jefatura y gerencia solo eliminan contenido ajeno dentro de su área',()=>{
 for(const cargo of ['Jefe','Gerente']){
  assert.equal(canDeleteOwned({...base,cargo},'other','one'),true);
  assert.equal(canDeleteOwned({...base,cargo},'other','two'),false);
 }
 assert.equal(canDeleteOwned({...base,isSuperAdmin:true},null,null),true);
 assert.equal(canDeleteOwned(base,null,'one'),false);
});
test('asistente y trabajador requieren aprobación aun siendo creadores',()=>{
 for(const cargo of ['Trabajador','Asistente'])assert.equal(requiresProjectDeleteApproval({...base,cargo}),true);
 assert.equal(requiresProjectDeleteApproval({...base,isSuperAdmin:true}),false);
});
test('solo gerente del área o administrador global aprueba la eliminación del proyecto',()=>{
 for(const cargo of ['Trabajador','Asistente','Tecnico','Administracion','Jefe'])assert.equal(canApproveProjectDeletion({...base,cargo},'one'),false);
 assert.equal(canApproveProjectDeletion({...base,cargo:'Gerente'},'one'),true);
 assert.equal(canApproveProjectDeletion({...base,cargo:'Gerente'},'two'),false);
 assert.equal(canApproveProjectDeletion({...base,isSuperAdmin:true},'two'),true);
});
test('comunicados limitados a Administración, Jefe, Gerente y administrador global',()=>{
 for(const cargo of ['Administracion','Jefe','Gerente'])assert.equal(canPublishAnnouncements({...base,cargo}),true);
 for(const cargo of ['Trabajador','Asistente','Tecnico'])assert.equal(canPublishAnnouncements({...base,cargo,rol:'Admin'}),false);
 assert.equal(isManagement({...base,cargo:'Administracion'}),false);
});
