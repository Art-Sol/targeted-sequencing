import { useEffect, useState } from 'react';
import { Modal, Input, Typography, Flex } from 'antd';
import type { ChangeEvent } from 'react';

const { Text } = Typography;

// Дублируется с server/src/routes/pipeline.ts (defence-in-depth).
// Расширять синхронно с серверным VALID_NAME_REGEX.
// Звёздочка (не +) разрешает пустую строку — иначе нельзя стереть всё имя.
const VALID_CHARS_REGEX = /^[\p{L}\p{N} _]*$/u;
const MAX_NAME_LENGTH = 100;

interface RunNameModalProps {
  open: boolean;
  /** Дефолтное значение инпута. Подставляется при каждом открытии модалки. */
  defaultName: string;
  /** Колбэк при подтверждении. Аргумент — имя после `trim()`. */
  onOk: (name: string) => void;
  onCancel: () => void;
}

/** Модалка ввода имени анализа перед запуском пайплайна. */
export const RunNameModal = ({ open, defaultName, onOk, onCancel }: RunNameModalProps) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [open, defaultName]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (VALID_CHARS_REGEX.test(value)) {
      setName(value);
    }
  };

  const trimmed = name.trim();
  const okDisabled = trimmed.length === 0;

  const handleOk = () => {
    if (okDisabled) return;
    onOk(trimmed);
  };

  return (
    <Modal
      title="Введите название анализа"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Запустить"
      cancelText="Отмена"
      okButtonProps={{ disabled: okDisabled }}
    >
      <Flex vertical gap={16}>
        <Input
          value={name}
          onChange={handleChange}
          maxLength={MAX_NAME_LENGTH}
          onPressEnter={handleOk}
          autoFocus
        />
        <Text type="secondary">Разрешены буквы, цифры, пробелы и нижнее подчёркивание.</Text>
      </Flex>
    </Modal>
  );
};
