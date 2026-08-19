import { PartialType } from '@nestjs/swagger';
import { CreateProblemDto } from './create-problem.dto';

/**
 * Every field is optional. Supplying `testCases` or `hints` replaces the whole
 * collection — omit them to leave the existing rows untouched.
 */
export class UpdateProblemDto extends PartialType(CreateProblemDto) {}
