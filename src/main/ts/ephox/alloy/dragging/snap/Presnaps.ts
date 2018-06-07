import { Option } from '@ephox/katamari';
import { Attr, Position } from '@ephox/sugar';
import { AlloyComponent } from '../../api/component/ComponentApi';
import { PositionCoordinates } from '../../alien/TypeDefinitions';
import { SnapsConfig } from '../../dragging/common/DraggingTypes';

// NOTE: Moved from ego with some parameterisation
const get = function (component: AlloyComponent, snapsInfo: SnapsConfig): Option<PositionCoordinates> {
  const element = component.element();
  const x = parseInt(Attr.get(element, snapsInfo.leftAttr()), 10);
  const y = parseInt(Attr.get(element, snapsInfo.topAttr()), 10);
  return isNaN(x) || isNaN(y) ? Option.none() : Option.some(
    Position(x, y)
  );
};

const set = function (component: AlloyComponent, snapsInfo: SnapsConfig, pt: PositionCoordinates): void {
  const element = component.element();
  Attr.set(element, snapsInfo.leftAttr(), pt.left() + 'px');
  Attr.set(element, snapsInfo.topAttr(), pt.top() + 'px');
};

const clear = function (component: AlloyComponent, snapsInfo: SnapsConfig): void {
  const element = component.element();
  Attr.remove(element, snapsInfo.leftAttr());
  Attr.remove(element, snapsInfo.topAttr());
};

export {
  get,
  set,
  clear
};