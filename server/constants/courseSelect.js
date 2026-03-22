export const COURSE_WITH_MODULES_LESSONS_SELECT =
  '*, modules:modules!modules_course_id_fkey(*, lessons:lessons!lessons_module_id_fkey(*))';

export const MODULE_LESSONS_FOREIGN_TABLE = 'modules.lessons!lessons_module_id_fkey';

export const COURSE_MODULES_WITH_LESSON_FIELDS =
  ',modules:modules!modules_course_id_fkey(id,course_id,title,description,order_index,lessons:lessons!lessons_module_id_fkey(id,module_id,title,description,type,order_index,duration_s,content_json,completion_rule_json))';

export const COURSE_MODULES_NO_LESSONS_FIELDS =
  ',modules:modules!modules_course_id_fkey(id,course_id,title,description,order_index)';
